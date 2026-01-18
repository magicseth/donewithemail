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

    try {
      // Request microphone permission on Android
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Microphone Permission",
            message: "TokMail needs access to your microphone to record voice replies",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error("Microphone permission denied");
        }
      }

      // Get Deepgram API key from backend
      const { apiKey } = await getDeepgramKey();

      // Connect to Deepgram WebSocket using subprotocol authentication
      const wsUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&smart_format=true&interim_results=true`;

      console.log("Connecting to Deepgram...");

      // Deepgram supports authentication via WebSocket subprotocols: ["token", "YOUR_API_KEY"]
      const ws = new WebSocket(wsUrl, ["token", apiKey]);

      ws.onopen = () => {
        console.log("Deepgram WebSocket connected successfully");
        setIsConnecting(false);
        setIsConnected(true);

        // Initialize and start live audio stream after WebSocket is connected
        LiveAudioStream.init({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6, // VOICE_RECOGNITION on Android
          bufferSize: 4096,
        });

        // Set up audio data handler - this fires with each audio chunk
        let chunkCount = 0;
        LiveAudioStream.on("data", (base64Data: string) => {
          chunkCount++;
          if (chunkCount <= 3 || chunkCount % 50 === 0) {
            console.log(`Audio chunk #${chunkCount}, size: ${base64Data.length} chars`);
          }
          if (ws.readyState === WebSocket.OPEN) {
            // Convert base64 to ArrayBuffer and send to Deepgram
            const arrayBuffer = base64ToArrayBuffer(base64Data);
            ws.send(arrayBuffer);
          }
        });

        LiveAudioStream.start();
        isStreamingRef.current = true;
        console.log("Live audio streaming started");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Log Deepgram responses for debugging
          if (data.type) {
            console.log("Deepgram message type:", data.type);
          }
          if (data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;
            console.log(`Deepgram transcript (final=${isFinal}):`, text);

            if (isFinal && text.trim()) {
              transcriptRef.current = transcriptRef.current
                ? `${transcriptRef.current} ${text}`
                : text;
              setTranscript(transcriptRef.current);
            } else if (!isFinal && text.trim()) {
              // Show interim results in real-time
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
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
    }
  }, [getDeepgramKey]);

  const stopRecording = useCallback(async (): Promise<string> => {
    const finalTranscript = transcriptRef.current;

    // Stop live audio stream
    if (isStreamingRef.current) {
      LiveAudioStream.stop();
      isStreamingRef.current = false;
      console.log("Live audio streaming stopped");
    }

    // Wait a bit for final transcription before closing WebSocket
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    return transcriptRef.current || finalTranscript;
  }, []);

  const cancelRecording = useCallback(() => {
    if (isStreamingRef.current) {
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
