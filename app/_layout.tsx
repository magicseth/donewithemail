// Import logger first to intercept all console calls
import "../lib/appLogger";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack } from "expo-router";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, Platform } from "react-native";
import { AuthProvider, useAuth } from "../lib/authContext";
import { AuthErrorProvider } from "../lib/AuthErrorBoundary";
import { usePushNotifications } from "../hooks/usePushNotifications";
import * as SecureStore from "expo-secure-store";

const AUTH_STORAGE_KEY = "donewith_auth";

// Signal for auth refresh - when set, the adapter will briefly clear token to force Convex re-auth
let lastAuthRefreshSignal = 0;
export function signalAuthRefresh() {
  lastAuthRefreshSignal = Date.now();
  console.log("[AuthAdapter] Auth refresh signaled at", lastAuthRefreshSignal);
}

// Decode JWT to check expiration (no logging - called frequently)
function debugJwt(token: string): { valid: boolean; exp?: number; iss?: string; error?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Not a JWT (expected 3 parts)" };
    }
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp && payload.exp < now;
    return { valid: !isExpired, exp: payload.exp, iss: payload.iss };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

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
  // Track the last refresh signal we processed
  const lastProcessedSignal = useRef(0);

  // Load token from storage on mount and when storage changes
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const loadToken = async () => {
      try {
        // Check if there's a new refresh signal - force Convex to re-authenticate
        // by briefly clearing the token, then setting the new one
        if (lastAuthRefreshSignal > lastProcessedSignal.current) {
          console.log("[AuthAdapter] Detected refresh signal, forcing re-auth");
          lastProcessedSignal.current = lastAuthRefreshSignal;

          // Clear token first to force Convex to re-authenticate
          if (token !== null) {
            console.log("[AuthAdapter] Clearing token to force re-auth cycle");
            setToken(null);
            // Return early - next poll cycle will set the new token
            return;
          }
        }

        const stored = await storage.getItem(AUTH_STORAGE_KEY);
        if (!isMounted) return;

        if (stored) {
          const parsed = JSON.parse(stored);
          const accessToken = parsed.accessToken || null;
          const expiresAt = parsed.expiresAt;

          // Check if token is expired - by stored expiresAt OR by JWT exp claim
          const isExpiredByStorage = expiresAt && Date.now() > expiresAt - 30000;
          const jwtInfo = accessToken ? debugJwt(accessToken) : { valid: false };
          const isExpiredByJwt = accessToken && !jwtInfo.valid;

          if (isExpiredByStorage || isExpiredByJwt) {
            console.log("[Auth] Token expired");
            if (token !== null) setToken(null);
          } else if (accessToken && accessToken !== token) {
            setToken(accessToken);
          } else if (!accessToken && token !== null) {
            setToken(null);
          }
        } else {
          if (token !== null) setToken(null);
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

    // Poll for token changes frequently to catch refreshes
    const interval = setInterval(loadToken, 500);
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
          return null;
        }

        // Also verify the JWT itself isn't expired
        if (accessToken) {
          const jwtInfo = debugJwt(accessToken);
          if (!jwtInfo.valid) return null;
        }

        return accessToken;
      }
    } catch (e) {
      console.error("[Auth] Failed to fetch token:", e);
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
  const { handleAuthError, refreshAccessToken } = useAuth();

  const onAuthError = useCallback(() => {
    // The error boundary caught an auth error, handle it
    handleAuthError(new Error("Unauthorized: Session expired"));
  }, [handleAuthError]);

  // Attempt to refresh auth token - returns true if successful
  const onAttemptRefresh = useCallback(async (): Promise<boolean> => {
    console.log("[AuthErrorHandler] Attempting auth refresh...");
    const newToken = await refreshAccessToken();
    return !!newToken;
  }, [refreshAccessToken]);

  return (
    <AuthErrorProvider onAuthError={onAuthError} onAttemptRefresh={onAttemptRefresh}>
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
