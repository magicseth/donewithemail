import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { router, useLocalSearchParams } from "expo-router";

export default function LinkGmailCallbackScreen() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Linking Gmail account...");
  const params = useLocalSearchParams();
  const linkGmailAccount = useAction(api.gmailAccountAuth.linkGmailAccount);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = params.code as string;
        const error = params.error as string;

        if (error) {
          setStatus("error");
          setMessage(`Authentication failed: ${error}`);
          setTimeout(() => router.replace("/(tabs)/settings"), 3000);
          return;
        }

        if (!code) {
          setStatus("error");
          setMessage("No authorization code received");
          setTimeout(() => router.replace("/(tabs)/settings"), 3000);
          return;
        }

        // Exchange code for tokens and link account
        const redirectUri = Platform.OS === "web"
          ? `${window.location.origin}/link-gmail-callback`
          : "donewith://link-gmail-callback";

        const result = await linkGmailAccount({
          code,
          redirectUri,
        });

        if (result.success) {
          setStatus("success");
          setMessage(`Successfully linked ${result.email}`);
          setTimeout(() => router.replace("/(tabs)/settings"), 2000);
        } else {
          setStatus("error");
          setMessage("Failed to link account");
          setTimeout(() => router.replace("/(tabs)/settings"), 3000);
        }
      } catch (error: any) {
        console.error("Link Gmail callback error:", error);
        setStatus("error");
        setMessage(error.message || "An error occurred");
        setTimeout(() => router.replace("/(tabs)/settings"), 3000);
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      {status === "loading" && <ActivityIndicator size="large" color="#6366F1" />}
      {status === "success" && (
        <View style={styles.iconContainer}>
          <Text style={styles.successIcon}>✓</Text>
        </View>
      )}
      {status === "error" && (
        <View style={styles.iconContainer}>
          <Text style={styles.errorIcon}>✕</Text>
        </View>
      )}
      <Text
        style={[
          styles.messageText,
          status === "success" && styles.successText,
          status === "error" && styles.errorText,
        ]}
      >
        {message}
      </Text>
      {status !== "loading" && (
        <Text style={styles.redirectText}>Redirecting to settings...</Text>
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
    padding: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 48,
    color: "#10B981",
  },
  errorIcon: {
    fontSize: 48,
    color: "#EF4444",
  },
  messageText: {
    fontSize: 18,
    textAlign: "center",
    color: "#1a1a1a",
    fontWeight: "500",
  },
  successText: {
    color: "#10B981",
  },
  errorText: {
    color: "#EF4444",
  },
  redirectText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
});
