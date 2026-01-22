import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { router } from "expo-router";

export default function LinkGmailScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the auth URL from Convex
  const redirectUri = Platform.OS === "web"
    ? `${window.location.origin}/link-gmail-callback`
    : "myapp://link-gmail-callback"; // For mobile, you'll need to configure deep linking

  const authUrl = useQuery(
    api.gmailAccountAuth.getGmailAuthUrl,
    { redirectUri }
  );

  useEffect(() => {
    if (authUrl) {
      setIsLoading(false);
      // Redirect to Google OAuth
      if (Platform.OS === "web") {
        window.location.href = authUrl;
      } else {
        // For mobile, you would use Linking.openURL(authUrl)
        // But for now, just show an error
        setError("Mobile linking not yet implemented");
      }
    }
  }, [authUrl]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={styles.loadingText}>Redirecting to Google...</Text>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
  },
});
