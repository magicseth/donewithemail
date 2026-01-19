import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack } from "expo-router";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, Platform } from "react-native";
import { AuthProvider, useAuth } from "../lib/authContext";
import { AuthErrorProvider } from "../lib/AuthErrorBoundary";
import { usePushNotifications } from "../hooks/usePushNotifications";
import * as SecureStore from "expo-secure-store";

const AUTH_STORAGE_KEY = "tokmail_auth";

// Initialize Convex client
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://your-deployment.convex.cloud"
);

// Storage helpers that work on both web and native
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return localStorage.getItem(key);
      }
      return null;
    }
    // On native, SecureStore may fail during early app initialization
    // when "user interaction is not allowed" - handle gracefully
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      // This error is expected during app startup on iOS/macOS
      if (errorMessage.includes("User interaction is not allowed")) {
        console.log("[Storage] Keychain not ready yet, will retry...");
        return null;
      }
      throw e;
    }
  },
};

/**
 * Auth adapter hook for ConvexProviderWithAuth.
 * Reads the stored token and provides it to Convex.
 * The AuthProvider handles token refresh - this adapter just reads the latest token.
 */
function useAuthAdapter() {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Load token from storage on mount and when storage changes
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const loadToken = async () => {
      try {
        const stored = await storage.getItem(AUTH_STORAGE_KEY);
        if (!isMounted) return;

        if (stored) {
          const parsed = JSON.parse(stored);
          const accessToken = parsed.accessToken || null;
          const expiresAt = parsed.expiresAt;

          // Check if token is expired (with 30 second buffer)
          if (expiresAt && Date.now() > expiresAt - 30000) {
            console.log("[AuthAdapter] Token expired, waiting for refresh...");
            // Don't provide expired token - AuthProvider will refresh it
            // Keep the old token state to maintain isAuthenticated while refreshing
          } else if (accessToken !== token) {
            setToken(accessToken);
          }
        } else {
          if (token !== null) {
            setToken(null);
          }
        }
        setIsLoading(false);
        retryCount = 0;
      } catch (e) {
        console.error("[AuthAdapter] Failed to load auth token:", e);
        if (retryCount < maxRetries && isMounted) {
          retryCount++;
          setTimeout(loadToken, 500);
          return;
        }
        if (isMounted) {
          setToken(null);
          setIsLoading(false);
        }
      }
    };

    // Small delay before first load to let the app initialize
    const initialDelay = Platform.OS === "web" ? 0 : 100;
    setTimeout(loadToken, initialDelay);

    // Poll for token changes more frequently to catch refreshes
    const interval = setInterval(loadToken, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  const fetchAccessToken = useCallback(async () => {
    // Re-read from storage to get latest token (may have been refreshed)
    try {
      const stored = await storage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const accessToken = parsed.accessToken || null;
        const expiresAt = parsed.expiresAt;

        // Don't return expired tokens
        if (expiresAt && Date.now() > expiresAt - 10000) {
          console.log("[AuthAdapter] fetchAccessToken: token expired");
          return null;
        }

        return accessToken;
      }
    } catch (e) {
      console.error("[AuthAdapter] Failed to fetch access token:", e);
    }
    return null;
  }, []);

  const result = useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!token,
      fetchAccessToken,
    }),
    [isLoading, token, fetchAccessToken]
  );

  return result;
}

// Component that registers push notifications
function PushNotificationHandler({ children }: { children: React.ReactNode }) {
  usePushNotifications();
  return <>{children}</>;
}

// Wrapper that provides auth error handling connected to the auth context
function AuthErrorHandler({ children }: { children: React.ReactNode }) {
  const { handleAuthError } = useAuth();

  const onAuthError = useCallback(() => {
    // The error boundary caught an auth error, handle it
    handleAuthError(new Error("Unauthorized: Session expired"));
  }, [handleAuthError]);

  return (
    <AuthErrorProvider onAuthError={onAuthError}>
      {children}
    </AuthErrorProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthAdapter}>
        <AuthProvider>
          <AuthErrorHandler>
            <PushNotificationHandler>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "slide_from_right",
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="email/[id]"
                  options={{
                    presentation: "card",
                    headerShown: true,
                    headerTitle: "Email",
                    headerBackTitle: "Back",
                  }}
                />
                <Stack.Screen
                  name="person/[id]"
                  options={{
                    presentation: "card",
                    headerShown: true,
                    headerTitle: "Contact",
                    headerBackTitle: "Back",
                  }}
                />
                <Stack.Screen
                  name="compose"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    headerTitle: "Compose",
                  }}
                />
              </Stack>
            </PushNotificationHandler>
          </AuthErrorHandler>
        </AuthProvider>
      </ConvexProviderWithAuth>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
