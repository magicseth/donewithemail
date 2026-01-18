import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

// Complete auth session for web
WebBrowser.maybeCompleteAuthSession();

const WORKOS_CLIENT_ID = process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID || "";
const WORKOS_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "tokmail",
  path: "callback",
});

// WorkOS AuthKit discovery document
const discovery = {
  authorizationEndpoint: "https://api.workos.com/user_management/authorize",
  tokenEndpoint: "https://api.workos.com/user_management/authenticate",
};

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
  signIn: () => Promise<void>;
  signOut: () => void;
  fetchAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthContextType["user"]>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: WORKOS_CLIENT_ID,
      redirectUri: WORKOS_REDIRECT_URI,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        provider: "authkit",
      },
    },
    discovery
  );

  // Handle the auth response
  useEffect(() => {
    if (response?.type === "success") {
      const { code } = response.params;
      exchangeCodeForToken(code);
    }
  }, [response]);

  const exchangeCodeForToken = async (code: string) => {
    try {
      setIsLoading(true);

      // Exchange code for token
      const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: WORKOS_CLIENT_ID,
          code,
          grant_type: "authorization_code",
          redirect_uri: WORKOS_REDIRECT_URI,
        }).toString(),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        setAccessToken(tokenData.access_token);

        // Decode user info from token or fetch from userinfo endpoint
        if (tokenData.user) {
          setUser({
            id: tokenData.user.id,
            email: tokenData.user.email,
            firstName: tokenData.user.first_name,
            lastName: tokenData.user.last_name,
          });
        }
      }
    } catch (error) {
      console.error("Token exchange error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = useCallback(async () => {
    if (!request) {
      console.error("Auth request not ready");
      return;
    }
    setIsLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [request, promptAsync]);

  const signOut = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const fetchAccessToken = useCallback(async () => {
    return accessToken;
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: !!accessToken && !!user,
        user,
        accessToken,
        signIn,
        signOut,
        fetchAccessToken,
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

// Hook for Convex auth integration
export function useConvexAuth() {
  const { isLoading, isAuthenticated, fetchAccessToken } = useAuth();

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}
