import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { handleGmailCallback } from "../lib/gmailAuth";

export default function GmailCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = handleGmailCallback();

    if (result.success) {
      setStatus("success");
      setTimeout(() => {
        router.replace("/(tabs)/settings");
      }, 1500);
    } else {
      setStatus("error");
      setError(result.error || "Unknown error");
    }
  }, [router]);

  return (
    <View style={styles.container}>
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.text}>Connecting Gmail...</Text>
        </>
      )}
      {status === "success" && (
        <>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.text}>Gmail connected!</Text>
          <Text style={styles.subtext}>Redirecting...</Text>
        </>
      )}
      {status === "error" && (
        <>
          <Text style={styles.errorIcon}>✗</Text>
          <Text style={styles.text}>Connection failed</Text>
          <Text style={styles.subtext}>{error}</Text>
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
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  successIcon: {
    fontSize: 48,
    color: "#22C55E",
  },
  errorIcon: {
    fontSize: 48,
    color: "#EF4444",
  },
});
