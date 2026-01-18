import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  AuthSession,
  getSession,
  setSession,
  clearSession,
  WorkOSUser,
} from "../lib/workos";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: WorkOSUser | null;
  userId: Id<"users"> | null;
}

/**
 * Hook for managing authentication state
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    userId: null,
  });

  const upsertUser = useMutation(api.users.upsertFromWorkOS);

  // Check for existing session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setAuthState({
        isLoading: false,
        isAuthenticated: true,
        user: session.user,
        userId: null, // Will be populated after DB lookup
      });
    } else {
      setAuthState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        userId: null,
      });
    }
  }, []);

  // Handle sign in
  const signIn = useCallback(
    async (session: AuthSession) => {
      setSession(session);

      // Upsert user in Convex
      const result = await upsertUser({
        workosId: session.user.id,
        email: session.user.email,
        name: session.user.firstName
          ? `${session.user.firstName} ${session.user.lastName || ""}`.trim()
          : undefined,
        avatarUrl: session.user.profilePictureUrl,
      });

      setAuthState({
        isLoading: false,
        isAuthenticated: true,
        user: session.user,
        userId: result.userId,
      });

      return result;
    },
    [upsertUser]
  );

  // Handle sign out
  const signOut = useCallback(() => {
    clearSession();
    setAuthState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      userId: null,
    });
  }, []);

  return {
    ...authState,
    signIn,
    signOut,
  };
}

/**
 * Hook for getting current user data from Convex
 */
export function useCurrentUser(userId: Id<"users"> | null) {
  return useQuery(api.users.getUser, userId ? { userId } : "skip");
}

/**
 * Hook for getting connected providers
 */
export function useConnectedProviders(userId: Id<"users"> | null) {
  return useQuery(
    api.users.getConnectedProviders,
    userId ? { userId } : "skip"
  );
}
