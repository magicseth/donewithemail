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
function useDeepgramVoice(): UseVoiceResult {
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

      // Connect to Deepgram WebSocket
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&smart_format=true&interim_results=true`,
        ["token", apiKey]
      );

      ws.onopen = () => {
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

      ws.onclose = () => {
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

      // Set up audio streaming callback
      recording.setOnRecordingStatusUpdate(async (status) => {
        if (status.isRecording && wsRef.current?.readyState === WebSocket.OPEN) {
          // Get the current audio data and send to Deepgram
          // Note: expo-av doesn't support real-time streaming natively
          // We'll send audio in chunks when recording stops
        }
      });

      await recording.startAsync();
      recordingRef.current = recording;

      // For expo-av, we need to periodically send audio chunks
      // This is a workaround since expo-av doesn't support streaming
      const sendAudioChunks = async () => {
        if (!recordingRef.current || !wsRef.current) return;

        try {
          const uri = recordingRef.current.getURI();
          if (uri) {
            // Read audio file and send to WebSocket
            const response = await fetch(uri);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();

            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(arrayBuffer);
            }
          }
        } catch (e) {
          console.error("Error sending audio chunk:", e);
        }
      };

      // Note: Real streaming requires a more complex setup with native modules
      // For now, we'll send the full recording when stopped

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

// Web fallback using browser's SpeechRecognition API (free, no API key needed)
export function useWebVoice(): UseVoiceResult {
  const [transcript, setTranscript] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined") {
      setError("Voice recording is not available in this environment");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setTranscript("");
    transcriptRef.current = "";

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsConnecting(false);
        setIsConnected(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = transcriptRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += " " + result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        transcriptRef.current = finalTranscript.trim();
        setTranscript(
          (finalTranscript + " " + interimTranscript).trim()
        );
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setError("Microphone access denied");
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }
        setIsConnecting(false);
        setIsConnected(false);
      };

      recognition.onend = () => {
        setIsConnected(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    const finalTranscript = transcriptRef.current;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setIsConnected(false);
    return finalTranscript;
  }, []);

  const cancelRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
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
  const deepgramVoice = useDeepgramVoice();
  const webVoice = useWebVoice();

  // Use Web Speech API on web (free), Deepgram on native
  if (Platform.OS === "web") {
    return webVoice;
  }

  return deepgramVoice;
}
