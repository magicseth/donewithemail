import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { signalAuthRefresh } from "../app/_layout";

// Complete any pending auth sessions on mount
WebBrowser.maybeCompleteAuthSession();

// Generate redirect URI using Expo's method
const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "tokmail",
  path: "callback",
});

console.log("OAuth Redirect URI:", REDIRECT_URI);

const AUTH_STORAGE_KEY = "tokmail_auth";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp when access token expires
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  handleCallback: (code: string) => Promise<{ success: boolean; hasGmailAccess: boolean }>;
  redirectUri: string;
  refreshAccessToken: () => Promise<string | null>;
  /** Handle auth errors by attempting to refresh, or signing out if refresh fails */
  handleAuthError: (error: Error) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Storage helpers that work on both web and native
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return localStorage.getItem(key);
      }
      return null;
    }
    // Use SecureStore for native
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, value);
      }
      return;
    }
    // Use SecureStore for native
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        localStorage.removeItem(key);
      }
      return;
    }
    // Use SecureStore for native
    await SecureStore.deleteItemAsync(key);
  },
};

// Refresh buffer - refresh token 60 seconds before expiration
const REFRESH_BUFFER_MS = 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get auth URL from Convex - pass the Expo-generated redirect URI
  const authUrl = useQuery(api.auth.getAuthUrl, { redirectUri: REDIRECT_URI });

  // Auth actions
  const authenticate = useAction(api.auth.authenticate);
  const refreshTokenAction = useAction(api.auth.refreshToken);

  // Load stored auth on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const stored = await storage.getItem(AUTH_STORAGE_KEY);
        console.log("[Auth] loadAuth - stored:", stored ? "found" : "not found");
        if (stored) {
          const parsed: StoredAuth = JSON.parse(stored);
          console.log("[Auth] loadAuth - parsed:", {
            hasUser: !!parsed.user,
            hasToken: !!parsed.accessToken,
            hasRefresh: !!parsed.refreshToken,
            expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt).toISOString() : null,
          });
          setUser(parsed.user);
          setAccessToken(parsed.accessToken);
          setRefreshToken(parsed.refreshToken || null);
          setExpiresAt(parsed.expiresAt || null);
        }
      } catch (e) {
        console.error("Failed to load stored auth:", e);
      }
      setIsLoading(false);
    };
    loadAuth();
  }, []);

  // Save auth to storage (with refresh token and expiration)
  const saveAuth = useCallback(async (
    userData: User,
    token: string,
    refresh?: string,
    expiresIn?: number
  ) => {
    console.log("[Auth] saveAuth called:", {
      hasUser: !!userData,
      hasToken: !!token,
      hasRefresh: !!refresh,
      expiresIn,
    });
    const expTime = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;
    await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      user: userData,
      accessToken: token,
      refreshToken: refresh,
      expiresAt: expTime,
    }));
    setUser(userData);
    setAccessToken(token);
    setRefreshToken(refresh || null);
    setExpiresAt(expTime || null);
    console.log("[Auth] Auth saved successfully");
  }, []);

  // Clear auth
  const clearAuth = useCallback(async () => {
    await storage.removeItem(AUTH_STORAGE_KEY);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      sessionStorage.clear();
    }
    setUser(null);
    setAccessToken(null);
  }, []);

  // Sign in using Expo WebBrowser
  const signIn = useCallback(async () => {
    if (!authUrl) {
      console.error("Auth URL not available");
      return;
    }

    try {
      // Open auth session in browser
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        // Extract authorization code from the returned URL
        const url = new URL(result.url);
        const code = url.searchParams.get("code");

        if (code) {
          // Exchange code for user profile
          const authResult = await handleCallback(code);
          if (authResult.success) {
            console.log("Authentication successful");
          }
        }
      } else if (result.type === "cancel") {
        console.log("Auth cancelled by user");
      }
    } catch (e) {
      console.error("Sign in failed:", e);
    }
  }, [authUrl]);

  // Sign out
  const signOut = useCallback(async () => {
    await clearAuth();
    // Navigation should be handled by the calling component
  }, [clearAuth]);

  // Handle OAuth callback (exchange code for user profile)
  const handleCallback = useCallback(
    async (code: string) => {
      setIsLoading(true);
      try {
        const result = await authenticate({ code });

        if (result.success && result.user) {
          await saveAuth(
            result.user,
            result.accessToken,
            result.refreshToken,
            result.expiresIn
          );
          return { success: true, hasGmailAccess: result.hasGmailAccess };
        }

        return { success: false, hasGmailAccess: false };
      } catch (e) {
        console.error("Authentication failed:", e);
        return { success: false, hasGmailAccess: false };
      } finally {
        setIsLoading(false);
      }
    },
    [authenticate, saveAuth]
  );

  // Track if we need to retry refresh when app becomes active
  const pendingRefreshRef = useRef(false);

  // Check if error is a connection-related error (should retry)
  const isConnectionError = (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("connection lost") ||
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("in flight") ||
        message.includes("failed to fetch")
      );
    }
    return false;
  };

  // Refresh access token using refresh token
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken || isRefreshing) {
      console.log("[Auth] Cannot refresh: no refresh token or already refreshing");
      return accessToken;
    }

    console.log("[Auth] Refreshing access token...");
    setIsRefreshing(true);
    pendingRefreshRef.current = false;

    try {
      const result = await refreshTokenAction({ refreshToken });

      if (result.success) {
        // Update stored auth with new tokens
        const stored = await storage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed: StoredAuth = JSON.parse(stored);
          const newExpiresAt = Date.now() + (result.expiresIn * 1000);
          await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
            ...parsed,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: newExpiresAt,
          }));
          setAccessToken(result.accessToken);
          setRefreshToken(result.refreshToken);
          setExpiresAt(newExpiresAt);
          console.log("[Auth] Token refreshed successfully, expires at:", new Date(newExpiresAt).toISOString());
          // Signal the auth adapter to force Convex re-authentication
          signalAuthRefresh();
          return result.accessToken;
        }
      }
      return null;
    } catch (e) {
      console.error("[Auth] Token refresh failed:", e);

      // Check if this is a connection error - if so, schedule retry instead of signing out
      if (isConnectionError(e)) {
        console.log("[Auth] Connection error during refresh, will retry when app becomes active");
        pendingRefreshRef.current = true;
        return accessToken; // Return existing token, don't clear auth
      }

      // Check if this is a transient OCC error - retry instead of signing out
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes("Data read or written in this mutation changed")) {
        console.log("[Auth] OCC error during refresh (transient), will retry when app becomes active");
        pendingRefreshRef.current = true;
        return accessToken; // Return existing token, don't clear auth
      }

      // For other errors (invalid token, etc.), sign out
      console.log("[Auth] Non-recoverable refresh error, signing out");
      await clearAuth();
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshToken, isRefreshing, accessToken, refreshTokenAction, clearAuth]);

  // Retry refresh when app becomes active (after connection loss)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && pendingRefreshRef.current && refreshToken && !isRefreshing) {
        console.log("[Auth] App became active, retrying pending token refresh");
        refreshAccessToken();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [refreshToken, isRefreshing, refreshAccessToken]);

  // Also retry on web when tab becomes visible
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingRefreshRef.current && refreshToken && !isRefreshing) {
        console.log("[Auth] Tab became visible, retrying pending token refresh");
        refreshAccessToken();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshToken, isRefreshing, refreshAccessToken]);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!expiresAt || !refreshToken || !user) return;

    const timeUntilExpiry = expiresAt - Date.now();
    const timeUntilRefresh = timeUntilExpiry - REFRESH_BUFFER_MS;

    if (timeUntilRefresh <= 0) {
      // Token is expired or about to expire, refresh now
      console.log("[Auth] Token expired or expiring soon, refreshing...");
      refreshAccessToken();
      return;
    }

    console.log(`[Auth] Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)}s`);
    const timer = setTimeout(() => {
      refreshAccessToken();
    }, timeUntilRefresh);

    return () => clearTimeout(timer);
  }, [expiresAt, refreshToken, user, refreshAccessToken]);

  // Handle auth errors from Convex queries/mutations
  const handleAuthError = useCallback(async (error: Error) => {
    const message = error.message.toLowerCase();

    // Check for Gmail-specific re-auth errors (refresh token revoked/expired)
    const needsReauth =
      message.includes("sign out and sign in") ||
      message.includes("gmail access has been revoked") ||
      message.includes("invalid_grant") ||
      message.includes("token has been revoked");

    if (needsReauth) {
      console.log("[Auth] Gmail re-authentication required, signing out:", error.message);
      await clearAuth();
      return;
    }

    // Check for general Convex auth errors (WorkOS JWT issues)
    const isAuthError =
      message.includes("unauthorized") ||
      message.includes("no valid authentication token") ||
      message.includes("not authenticated") ||
      message.includes("authentication required") ||
      message.includes("invalid token") ||
      message.includes("token expired");

    if (!isAuthError) {
      console.log("[Auth] handleAuthError called with non-auth error:", error.message);
      return;
    }

    console.log("[Auth] Handling auth error, attempting token refresh...");

    // Try to refresh the token first
    if (refreshToken) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        console.log("[Auth] Token refreshed successfully after auth error");
        return;
      }
    }

    // If refresh failed or no refresh token, sign out
    console.log("[Auth] Token refresh failed or unavailable, signing out");
    await clearAuth();
  }, [refreshToken, refreshAccessToken, clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: !!user,
        user,
        accessToken,
        signIn,
        signOut,
        handleCallback,
        redirectUri: REDIRECT_URI,
        refreshAccessToken,
        handleAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
