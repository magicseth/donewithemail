import React, { createContext, useContext, useCallback } from "react";
import {
  AuthKitProvider,
  useAuth as useAuthKitAuth,
} from "@workos-inc/authkit-react";

const WORKOS_CLIENT_ID = process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID || "";
const WORKOS_REDIRECT_URI = process.env.EXPO_PUBLIC_WORKOS_REDIRECT_URI || "http://localhost:8081/callback";

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  accessToken: string | null;
  signIn: () => void;
  signOut: () => void;
  fetchAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const authKit = useAuthKitAuth();

  const user = authKit.user
    ? {
        id: authKit.user.id,
        email: authKit.user.email,
        firstName: authKit.user.firstName ?? undefined,
        lastName: authKit.user.lastName ?? undefined,
      }
    : null;

  const fetchAccessToken = useCallback(async () => {
    // AuthKit handles token management internally
    // This is used by Convex to get the access token
    try {
      const token = await authKit.getAccessToken();
      return token || null;
    } catch {
      return null;
    }
  }, [authKit]);

  return (
    <AuthContext.Provider
      value={{
        isLoading: authKit.isLoading,
        isAuthenticated: !!authKit.user,
        user,
        accessToken: null, // Managed by AuthKit
        signIn: authKit.signIn,
        signOut: authKit.signOut,
        fetchAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthKitProvider
      clientId={WORKOS_CLIENT_ID}
      redirectUri={WORKOS_REDIRECT_URI}
    >
      <AuthContextProvider>{children}</AuthContextProvider>
    </AuthKitProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Hook for Convex auth integration
export function useConvexAuth() {
  const { isLoading, isAuthenticated, fetchAccessToken } = useAuth();

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}
