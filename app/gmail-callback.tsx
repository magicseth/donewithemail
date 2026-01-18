import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

const GMAIL_REDIRECT_URI =
  process.env.EXPO_PUBLIC_GMAIL_REDIRECT_URI ||
  "http://localhost:8081/gmail-callback";

export default function GmailCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState("Connecting Gmail...");
  const [error, setError] = useState<string | null>(null);
  const exchangeCode = useAction(api.gmailOAuth.exchangeCode);

  useEffect(() => {
    async function handleCallback() {
      const code = params.code as string | undefined;
      const errorParam = params.error as string | undefined;

      if (errorParam) {
        setError(`OAuth error: ${errorParam}`);
        setTimeout(() => router.replace("/(tabs)/settings"), 2000);
        return;
      }

      if (!code) {
        setError("No authorization code received");
        setTimeout(() => router.replace("/(tabs)/settings"), 2000);
        return;
      }

      try {
        const result = await exchangeCode({
          code,
          redirectUri: GMAIL_REDIRECT_URI,
        });

        setStatus(`Gmail connected for ${result.email}!`);
        setTimeout(() => router.replace("/(tabs)"), 1500);
      } catch (e) {
        console.error("Gmail OAuth error:", e);
        setError(e instanceof Error ? e.message : "Failed to connect Gmail");
        setTimeout(() => router.replace("/(tabs)/settings"), 3000);
      }
    }

    handleCallback();
  }, [params.code, params.error, exchangeCode, router]);

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
