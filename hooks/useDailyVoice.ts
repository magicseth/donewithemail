import { useState, useCallback, useRef, useEffect } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

interface UseVoiceResult {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => void;
  transcript: string;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

// Native implementation using expo-av + Deepgram WebSocket
function useDeepgramNative(): UseVoiceResult {
  const [transcript, setTranscript] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef("");

  const getDeepgramKey = useAction(api.voice.getDeepgramKey);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
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
      // Request microphone permission
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        throw new Error("Microphone permission denied");
      }

      // Get Deepgram API key from backend
      const { apiKey } = await getDeepgramKey();

      // Configure audio for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Connect to Deepgram WebSocket using subprotocol authentication
      const wsUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&smart_format=true&interim_results=true`;

      console.log("Connecting to Deepgram...");

      // Deepgram supports authentication via WebSocket subprotocols: ["token", "YOUR_API_KEY"]
      const ws = new WebSocket(wsUrl, ["token", apiKey]);

      ws.onopen = () => {
        console.log("Deepgram WebSocket connected successfully");
        setIsConnecting(false);
        setIsConnected(true);
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
              // Show interim results
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

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: ".wav",
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
    }
  }, [getDeepgramKey]);

  const stopRecording = useCallback(async (): Promise<string> => {
    const finalTranscript = transcriptRef.current;

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();

        // Send final audio to Deepgram
        const uri = recordingRef.current.getURI();
        if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          wsRef.current.send(arrayBuffer);

          // Wait a bit for final transcription
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
      recordingRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    return transcriptRef.current || finalTranscript;
  }, []);

  const cancelRecording = useCallback(() => {
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(console.error);
      recordingRef.current = null;
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

    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    }).catch(console.error);
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
