import { useState, useCallback, useRef, useEffect } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import LiveAudioStream from "react-native-live-audio-stream";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

// Helper function to convert base64 to ArrayBuffer (React Native compatible)
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  // Use a lookup table for better performance
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Remove padding and whitespace
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanBase64.length;
  const bufferLength = Math.floor(len * 3 / 4);
  const bytes = new Uint8Array(bufferLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[cleanBase64.charCodeAt(i)];
    const encoded2 = lookup[cleanBase64.charCodeAt(i + 1)];
    const encoded3 = lookup[cleanBase64.charCodeAt(i + 2)];
    const encoded4 = lookup[cleanBase64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (i + 2 < len) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (i + 3 < len) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
  }

  return bytes.buffer;
};

interface UseVoiceResult {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => void;
  transcript: string;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

// Native implementation using react-native-live-audio-stream + Deepgram WebSocket
function useDeepgramNative(): UseVoiceResult {
  const [transcript, setTranscript] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef("");
  const isStreamingRef = useRef(false);

  const getDeepgramKey = useAction(api.voice.getDeepgramKey);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreamingRef.current) {
        LiveAudioStream.stop();
        isStreamingRef.current = false;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setTranscript("");
    transcriptRef.current = "";

    // Buffer to hold audio chunks until WebSocket connects
    const audioBuffer: ArrayBuffer[] = [];
    let wsConnected = false;
    let ws: WebSocket | null = null;

    try {
      // Request microphone permission on Android
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Microphone Permission",
            message: "DoneWith needs access to your microphone to record voice replies",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error("Microphone permission denied");
        }
      }

      // Start audio capture IMMEDIATELY (before WebSocket connects)
      console.log("Starting audio capture immediately...");
      try {
        LiveAudioStream.stop();
      } catch {
        // Ignore if not running
      }

      LiveAudioStream.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6, // VOICE_RECOGNITION on Android
        bufferSize: 4096,
        wavFile: "", // Not saving to file, streaming only
      });

      // Set up audio data handler - buffers until WS ready, then streams
      let chunkCount = 0;
      let totalBytesSent = 0;
      LiveAudioStream.on("data", (base64Data: string) => {
        chunkCount++;
        const arrayBuffer = base64ToArrayBuffer(base64Data);

        if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
          // WebSocket ready - send directly
          totalBytesSent += arrayBuffer.byteLength;
          if (chunkCount <= 5 || chunkCount % 25 === 0) {
            console.log(`[Audio] chunk #${chunkCount}, bytes=${arrayBuffer.byteLength}, totalSent=${totalBytesSent}`);
          }
          ws.send(arrayBuffer);
        } else {
          // Buffer until WebSocket connects
          audioBuffer.push(arrayBuffer);
          if (chunkCount <= 5) {
            console.log(`[Audio] buffering chunk #${chunkCount}, bytes=${arrayBuffer.byteLength}, buffered=${audioBuffer.length}`);
          }
        }
      });

      LiveAudioStream.start();
      isStreamingRef.current = true;
      console.log("Audio capture started, connecting to Deepgram...");

      // Get Deepgram API key from backend (in parallel with audio capture)
      const { apiKey } = await getDeepgramKey();

      // Connect to Deepgram WebSocket
      const wsUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&smart_format=true&interim_results=true`;
      ws = new WebSocket(wsUrl, ["token", apiKey]);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log(`Deepgram connected, sending ${audioBuffer.length} buffered chunks...`);
        setIsConnecting(false);
        setIsConnected(true);
        wsConnected = true;

        // Send all buffered audio first
        for (const chunk of audioBuffer) {
          totalBytesSent += chunk.byteLength;
          ws!.send(chunk);
        }
        console.log(`Sent ${audioBuffer.length} buffered chunks (${totalBytesSent} bytes), now streaming live`);
        audioBuffer.length = 0; // Clear buffer
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Log all Deepgram responses for debugging
          console.log("[Deepgram] Received message:", JSON.stringify(data).slice(0, 200));

          if (data.type === "Metadata") {
            console.log("[Deepgram] Metadata received - audio processing started");
          } else if (data.type === "Results") {
            const transcript = data.channel?.alternatives?.[0]?.transcript || "";
            const isFinal = data.is_final;
            const speechFinal = data.speech_final;
            console.log(`[Deepgram] Results: final=${isFinal}, speechFinal=${speechFinal}, transcript="${transcript}"`);

            if (transcript.trim()) {
              if (isFinal) {
                transcriptRef.current = transcriptRef.current
                  ? `${transcriptRef.current} ${transcript}`
                  : transcript;
                setTranscript(transcriptRef.current);
                console.log(`[Deepgram] Updated final transcript: "${transcriptRef.current}"`);
              } else {
                // Show interim results in real-time
                const interimDisplay = transcriptRef.current
                  ? `${transcriptRef.current} ${transcript}`
                  : transcript;
                setTranscript(interimDisplay);
                console.log(`[Deepgram] Interim transcript: "${interimDisplay}"`);
              }
            } else if (isFinal) {
              console.log("[Deepgram] Empty final result (silence detected)");
            }
          } else if (data.type === "SpeechStarted") {
            console.log("[Deepgram] Speech detected!");
          } else if (data.type === "UtteranceEnd") {
            console.log("[Deepgram] Utterance ended");
          }
        } catch (e) {
          console.error("[Deepgram] Error parsing message:", e);
          console.error("[Deepgram] Raw event data:", event.data);
        }
      };

      ws.onerror = (e) => {
        console.error("[Deepgram Native] WebSocket error:", e);
        setError("Connection error");
        setIsConnecting(false);
        setIsConnected(false);
      };

      ws.onclose = (e) => {
        console.log(`[Deepgram Native] WebSocket closed: code=${e.code}, reason="${e.reason}"`);
        setIsConnected(false);
        // Stop audio stream if still running
        if (isStreamingRef.current) {
          console.log("[Deepgram Native] Stopping LiveAudioStream due to WebSocket close");
          LiveAudioStream.stop();
          isStreamingRef.current = false;
        }
      };

      wsRef.current = ws;

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
    }
  }, [getDeepgramKey]);

  const stopRecording = useCallback(async (): Promise<string> => {
    console.log("[Voice] stopRecording called");
    const initialTranscript = transcriptRef.current;

    // Stop live audio stream
    if (isStreamingRef.current) {
      LiveAudioStream.stop();
      isStreamingRef.current = false;
      console.log("[Voice] Live audio streaming stopped");
    }

    // Signal to Deepgram that we're done sending audio
    // Send an empty ArrayBuffer to indicate end of stream
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("[Voice] Sending end-of-stream signal to Deepgram");
      wsRef.current.send(new ArrayBuffer(0));
    }

    // Wait for Deepgram to finish processing and send final transcript
    // Use a longer timeout and check for transcript updates
    console.log("[Voice] Waiting for final transcript...");
    const startWait = Date.now();
    const maxWaitMs = 2000; // Wait up to 2 seconds for final transcript

    while (Date.now() - startWait < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      // If transcript changed, Deepgram is still processing
      if (transcriptRef.current !== initialTranscript) {
        console.log("[Voice] Transcript updated, waiting a bit more...");
        await new Promise((resolve) => setTimeout(resolve, 300));
        break;
      }
    }

    const finalTranscript = transcriptRef.current;
    console.log(`[Voice] Final transcript: "${finalTranscript}"`);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    return finalTranscript || initialTranscript;
  }, []);

  const cancelRecording = useCallback(() => {
    console.log("[Voice] cancelRecording called");
    if (isStreamingRef.current) {
      console.log("[Voice] Cancelling active stream");
      LiveAudioStream.stop();
      isStreamingRef.current = false;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setTranscript("");
    transcriptRef.current = "";
    setIsConnecting(false);
    setIsConnected(false);
    setError(null);
  }, []);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
    error,
  };
}

// Web implementation using MediaRecorder + Deepgram WebSocket
function useDeepgramWeb(): UseVoiceResult {
  const [transcript, setTranscript] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef("");

  const getDeepgramKey = useAction(api.voice.getDeepgramKey);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices) {
      setError("Media devices not available");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setTranscript("");
    transcriptRef.current = "";

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Get Deepgram API key from backend
      const { apiKey } = await getDeepgramKey();

      // Connect to Deepgram WebSocket
      // For web, we use webm/opus encoding which Deepgram supports
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true`;

      console.log("Connecting to Deepgram (web)...");

      const ws = new WebSocket(wsUrl, ["token", apiKey]);

      ws.onopen = () => {
        console.log("Deepgram WebSocket connected (web)");
        setIsConnecting(false);
        setIsConnected(true);

        // Start MediaRecorder after WebSocket is open
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunks every 250ms
        mediaRecorderRef.current = mediaRecorder;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;

            if (isFinal && text.trim()) {
              transcriptRef.current = transcriptRef.current
                ? `${transcriptRef.current} ${text}`
                : text;
              setTranscript(transcriptRef.current);
            } else if (!isFinal && text.trim()) {
              setTranscript(
                transcriptRef.current
                  ? `${transcriptRef.current} ${text}`
                  : text
              );
            }
          }
        } catch (e) {
          console.error("Error parsing Deepgram message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("Connection error");
        setIsConnecting(false);
        setIsConnected(false);
      };

      ws.onclose = (e) => {
        console.log("WebSocket closed:", { code: e.code, reason: e.reason });
        setIsConnected(false);
      };

      wsRef.current = ws;

    } catch (err) {
      console.error("Error starting recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
    }
  }, [getDeepgramKey]);

  const stopRecording = useCallback(async (): Promise<string> => {
    const finalTranscript = transcriptRef.current;

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Wait a bit for final transcription before closing WebSocket
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    return transcriptRef.current || finalTranscript;
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setTranscript("");
    transcriptRef.current = "";
    setIsConnecting(false);
    setIsConnected(false);
    setError(null);
  }, []);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
    error,
  };
}

// Combined hook that uses the appropriate implementation
export function useVoiceRecording(): UseVoiceResult {
  const nativeVoice = useDeepgramNative();
  const webVoice = useDeepgramWeb();

  // Use Deepgram on both web and native
  if (Platform.OS === "web") {
    return webVoice;
  }

  return nativeVoice;
}
