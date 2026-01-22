import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { router } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

// Required for web browser redirect
WebBrowser.maybeCompleteAuthSession();

// Google OAuth discovery document
const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export default function LinkGmailScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const linkGmailAccount = useAction(api.gmailAccountAuth.linkGmailAccount);

  // For web, use window.location.origin
  // For mobile, use AuthSession's redirect URI (uses Expo proxy)
  const redirectUri = Platform.OS === "web"
    ? `${window.location.origin}/link-gmail-callback`
    : AuthSession.makeRedirectUri({ preferLocalhost: false });

  // Get auth URL from Convex (for web) or build it for mobile
  const authUrl = useQuery(
    api.gmailAccountAuth.getGmailAuthUrl,
    Platform.OS === "web" ? { redirectUri } : "skip"
  );

  // For mobile, use AuthSession hook
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
      scopes: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    discovery
  );

  // Handle mobile OAuth response
  useEffect(() => {
    if (Platform.OS !== "web" && response) {
      if (response.type === "success" && response.params.code) {
        // Exchange code for tokens via our backend
        handleMobileCallback(response.params.code);
      } else if (response.type === "error") {
        setError(response.error?.message || "Authentication failed");
        setIsLoading(false);
      } else if (response.type === "cancel" || response.type === "dismiss") {
        router.replace("/(tabs)/settings");
      }
    }
  }, [response]);

  const handleMobileCallback = async (code: string) => {
    try {
      const result = await linkGmailAccount({
        code,
        redirectUri,
      });

      if (result.success) {
        router.replace("/(tabs)/settings");
      } else {
        setError("Failed to link account");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Link Gmail error:", err);
      setError(err.message || "An error occurred");
      setIsLoading(false);
    }
  };

  // Web: redirect to Google OAuth
  useEffect(() => {
    if (Platform.OS === "web" && authUrl) {
      setIsLoading(false);
      window.location.href = authUrl;
    }
  }, [authUrl]);

  // Mobile: auto-start OAuth when request is ready
  useEffect(() => {
    if (Platform.OS !== "web" && request) {
      setIsLoading(false);
      promptAsync();
    }
  }, [request]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Text
          style={styles.backLink}
          onPress={() => router.replace("/(tabs)/settings")}
        >
          Back to Settings
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={styles.loadingText}>
        {Platform.OS === "web" ? "Redirecting to Google..." : "Opening Google Sign In..."}
      </Text>
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
    marginBottom: 16,
  },
  backLink: {
    fontSize: 16,
    color: "#6366F1",
    textDecorationLine: "underline",
  },
});
