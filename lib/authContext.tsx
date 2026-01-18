import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";

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
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  handleCallback: (code: string) => Promise<{ success: boolean; hasGmailAccess: boolean }>;
  redirectUri: string;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get auth URL from Convex - pass the Expo-generated redirect URI
  const authUrl = useQuery(api.auth.getAuthUrl, { redirectUri: REDIRECT_URI });

  // Authenticate action
  const authenticate = useAction(api.auth.authenticate);

  // Load stored auth on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const stored = await storage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed: StoredAuth = JSON.parse(stored);
          setUser(parsed.user);
          setAccessToken(parsed.accessToken);
        }
      } catch (e) {
        console.error("Failed to load stored auth:", e);
      }
      setIsLoading(false);
    };
    loadAuth();
  }, []);

  // Save auth to storage
  const saveAuth = useCallback(async (userData: User, token: string) => {
    await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userData, accessToken: token }));
    setUser(userData);
    setAccessToken(token);
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
          await saveAuth(result.user, result.accessToken);
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

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: !!user,
        user,
        signIn,
        signOut,
        handleCallback,
        redirectUri: REDIRECT_URI,
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
