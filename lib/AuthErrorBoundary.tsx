import React, { Component, createContext, useContext, useCallback, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";

/**
 * Context for signaling auth errors from anywhere in the app.
 * Components can call `reportAuthError` when they detect an unauthorized error.
 */
interface AuthErrorContextType {
  reportAuthError: (error: Error) => void;
  clearAuthError: () => void;
  hasAuthError: boolean;
}

const AuthErrorContext = createContext<AuthErrorContextType | null>(null);

/**
 * Hook to access auth error reporting.
 * Returns a no-op if called outside AuthErrorProvider (for safety during app init).
 */
export function useAuthError(): AuthErrorContextType {
  const ctx = useContext(AuthErrorContext);
  if (!ctx) {
    // Return a no-op implementation if context isn't available
    // This can happen during app initialization or in tests
    return {
      reportAuthError: (error: Error) => {
        console.warn("[useAuthError] Called outside AuthErrorProvider:", error.message);
      },
      clearAuthError: () => {},
      hasAuthError: false,
    };
  }
  return ctx;
}

/**
 * Check if an error is an authentication/authorization error.
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      // Convex/WorkOS auth errors
      message.includes("unauthorized") ||
      message.includes("no valid authentication token") ||
      message.includes("not authenticated") ||
      message.includes("authentication required") ||
      message.includes("invalid token") ||
      message.includes("token expired") ||
      // Gmail-specific auth errors (refresh token revoked)
      message.includes("sign out and sign in") ||
      message.includes("gmail access has been revoked") ||
      message.includes("invalid_grant") ||
      message.includes("token has been revoked")
    );
  }
  return false;
}

interface Props {
  children: React.ReactNode;
  onAuthError?: () => void;
  /** Called when auth error is caught - should attempt to refresh auth */
  onAttemptRefresh?: () => Promise<boolean>;
  /** Whether a refresh is currently in progress */
  isRefreshing?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isAuthError: boolean;
  isAttemptingRefresh: boolean;
}

/**
 * Error boundary that catches render errors, including Convex query errors.
 * When an auth error is detected, it automatically attempts to refresh auth.
 * If refresh fails, it shows a "Session expired" message.
 */
class AuthErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isAuthError: false, isAttemptingRefresh: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const authError = isAuthError(error);
    return { hasError: true, error, isAuthError: authError };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AuthErrorBoundary] Caught error:", error.message);
    console.error("[AuthErrorBoundary] Component stack:", errorInfo.componentStack);

    if (isAuthError(error)) {
      // Try to refresh auth automatically
      if (this.props.onAttemptRefresh) {
        this.setState({ isAttemptingRefresh: true });
        try {
          const refreshed = await this.props.onAttemptRefresh();
          if (refreshed) {
            // Refresh succeeded - clear error and re-render
            console.log("[AuthErrorBoundary] Auth refresh succeeded, retrying render");
            this.setState({ hasError: false, error: null, isAuthError: false, isAttemptingRefresh: false });
            return;
          }
        } catch (refreshError) {
          console.error("[AuthErrorBoundary] Auth refresh failed:", refreshError);
        }
        this.setState({ isAttemptingRefresh: false });
      }

      // Refresh failed or not available - notify parent
      if (this.props.onAuthError) {
        this.props.onAuthError();
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isAuthError: false, isAttemptingRefresh: false });
  };

  render() {
    // Show loading while attempting refresh
    if (this.state.isAttemptingRefresh || this.props.isRefreshing) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.message}>Refreshing session...</Text>
        </View>
      );
    }

    if (this.state.hasError) {
      if (this.state.isAuthError) {
        return (
          <View style={styles.container}>
            <Text style={styles.title}>Session Expired</Text>
            <Text style={styles.message}>
              Your session has expired. Please sign in again to continue.
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Provider that wraps components with auth error detection.
 * Provides a `reportAuthError` function that child components can call
 * when they detect auth errors (e.g., from try/catch blocks around mutations).
 *
 * Automatically attempts to refresh auth when errors occur.
 */
export function AuthErrorProvider({
  children,
  onAuthError,
  onAttemptRefresh,
}: {
  children: React.ReactNode;
  onAuthError?: () => void;
  /** Called when auth error occurs - should attempt to refresh and return true if successful */
  onAttemptRefresh?: () => Promise<boolean>;
}) {
  const [hasAuthError, setHasAuthError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshAttemptedRef = useRef(false);

  const attemptRefresh = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshing || refreshAttemptedRef.current) {
      return false;
    }

    if (!onAttemptRefresh) {
      return false;
    }

    refreshAttemptedRef.current = true;
    setIsRefreshing(true);

    try {
      const result = await onAttemptRefresh();
      if (result) {
        // Reset after successful refresh so future errors can trigger refresh again
        refreshAttemptedRef.current = false;
        setHasAuthError(false);
      }
      return result;
    } catch (e) {
      console.error("[AuthErrorProvider] Refresh attempt failed:", e);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [onAttemptRefresh, isRefreshing]);

  const reportAuthError = useCallback(
    async (error: Error) => {
      if (isAuthError(error)) {
        console.log("[AuthErrorProvider] Auth error reported:", error.message);

        // Try to refresh first
        const refreshed = await attemptRefresh();
        if (refreshed) {
          console.log("[AuthErrorProvider] Auth refreshed successfully");
          return;
        }

        setHasAuthError(true);
        if (onAuthError) {
          onAuthError();
        }
      }
    },
    [onAuthError, attemptRefresh]
  );

  const clearAuthError = useCallback(() => {
    setHasAuthError(false);
    refreshAttemptedRef.current = false;
  }, []);

  return (
    <AuthErrorContext.Provider value={{ reportAuthError, clearAuthError, hasAuthError }}>
      <AuthErrorBoundaryClass
        onAuthError={onAuthError}
        onAttemptRefresh={attemptRefresh}
        isRefreshing={isRefreshing}
      >
        {children}
      </AuthErrorBoundaryClass>
    </AuthErrorContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
