import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery, useAction, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

// Required for web browser redirect
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export default function LinkGmailScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const linkGmailAccount = useAction(api.gmailAccountAuth.linkGmailAccount);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // For web, use the callback page. For mobile, use Expo's auth proxy.
  const webRedirectUri = Platform.OS === "web"
    ? `${window.location.origin}/link-gmail-callback`
    : null;

  // Construct Expo auth proxy URL for mobile
  const expoOwner = Constants.expoConfig?.owner || "magicseth";
  const expoSlug = Constants.expoConfig?.slug || "DoneWith";
  const mobileRedirectUri = `https://auth.expo.io/@${expoOwner}/${expoSlug}`;

  const redirectUri = Platform.OS === "web" ? webRedirectUri! : mobileRedirectUri;

  // Get auth URL from Convex for web
  const authUrl = useQuery(
    api.gmailAccountAuth.getGmailAuthUrl,
    Platform.OS === "web" ? { redirectUri } : "skip"
  );

  // Build Google OAuth URL for mobile
  const buildGoogleAuthUrl = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: mobileRedirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // Handle mobile OAuth
  const startMobileAuth = async () => {
    try {
      const authUrl = buildGoogleAuthUrl();
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        mobileRedirectUri
      );

      if (result.type === "success" && result.url) {
        // Extract code from URL
        const url = new URL(result.url);
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          setIsLoading(false);
          return;
        }

        if (code) {
          await handleCallback(code);
        } else {
          setError("No authorization code received");
          setIsLoading(false);
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        router.replace("/(tabs)/settings");
      }
    } catch (err: any) {
      console.error("Mobile auth error:", err);
      setError(err.message || "Authentication failed");
      setIsLoading(false);
    }
  };

  const handleCallback = async (code: string) => {
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

  // Mobile: wait for auth then start OAuth
  useEffect(() => {
    if (Platform.OS !== "web" && !authLoading && isAuthenticated) {
      startMobileAuth();
    } else if (Platform.OS !== "web" && !authLoading && !isAuthenticated) {
      setError("Please sign in first");
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated]);

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
