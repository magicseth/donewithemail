import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/authContext";

export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { handleCallback } = useAuth();
  const [status, setStatus] = useState("Signing you in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      const code = params.code as string | undefined;
      const errorParam = params.error as string | undefined;

      if (errorParam) {
        setError(`OAuth error: ${errorParam}`);
        setTimeout(() => router.replace("/"), 3000);
        return;
      }

      if (!code) {
        setError("No authorization code received");
        setTimeout(() => router.replace("/"), 3000);
        return;
      }

      try {
        setStatus("Connecting your account...");
        const result = await handleCallback(code);

        if (result.success) {
          if (result.hasGmailAccess) {
            setStatus("Gmail connected! Redirecting...");
          } else {
            setStatus("Signed in! Redirecting...");
          }
          setTimeout(() => router.replace("/(tabs)"), 1000);
        } else {
          setError("Authentication failed. Please try again.");
          setTimeout(() => router.replace("/"), 3000);
        }
      } catch (e) {
        console.error("Callback error:", e);
        setError(e instanceof Error ? e.message : "Authentication failed");
        setTimeout(() => router.replace("/"), 3000);
      }
    }

    processCallback();
  }, [params.code, params.error, handleCallback, router]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.errorIcon}>✕</Text>
          <Text style={styles.errorText}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.text}>{status}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorIcon: {
    fontSize: 48,
    color: "#EF4444",
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
