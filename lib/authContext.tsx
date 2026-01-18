import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";

const REDIRECT_URI =
  process.env.EXPO_PUBLIC_WORKOS_REDIRECT_URI || "http://localhost:8081/callback";

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
  signIn: () => void;
  signOut: () => void;
  handleCallback: (code: string) => Promise<{ success: boolean; hasGmailAccess: boolean }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get auth URL from Convex
  const authUrl = useQuery(api.auth.getAuthUrl, { redirectUri: REDIRECT_URI });

  // Authenticate action
  const authenticate = useAction(api.auth.authenticate);

  // Load stored auth on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed: StoredAuth = JSON.parse(stored);
          setUser(parsed.user);
          setAccessToken(parsed.accessToken);
        }
      } catch (e) {
        console.error("Failed to load stored auth:", e);
      }
    }
    setIsLoading(false);
  }, []);

  // Save auth to storage
  const saveAuth = useCallback((user: User, accessToken: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user, accessToken })
      );
    }
    setUser(user);
    setAccessToken(accessToken);
  }, []);

  // Clear auth
  const clearAuth = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.clear();
    }
    setUser(null);
    setAccessToken(null);
  }, []);

  // Sign in - redirect to WorkOS
  const signIn = useCallback(() => {
    if (authUrl && typeof window !== "undefined") {
      window.location.href = authUrl;
    }
  }, [authUrl]);

  // Sign out
  const signOut = useCallback(() => {
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, [clearAuth]);

  // Handle OAuth callback
  const handleCallback = useCallback(
    async (code: string) => {
      setIsLoading(true);
      try {
        const result = await authenticate({ code });

        if (result.success && result.user) {
          saveAuth(result.user, result.accessToken);
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
