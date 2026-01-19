import React, { Component, createContext, useContext, useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";

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
      message.includes("unauthorized") ||
      message.includes("no valid authentication token") ||
      message.includes("not authenticated") ||
      message.includes("authentication required") ||
      message.includes("invalid token") ||
      message.includes("token expired")
    );
  }
  return false;
}

interface Props {
  children: React.ReactNode;
  onAuthError?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isAuthError: boolean;
}

/**
 * Error boundary that catches render errors, including Convex query errors.
 * When an auth error is detected, it shows a "Session expired" message
 * and allows the user to sign in again.
 */
class AuthErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isAuthError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const authError = isAuthError(error);
    return { hasError: true, error, isAuthError: authError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AuthErrorBoundary] Caught error:", error.message);
    console.error("[AuthErrorBoundary] Component stack:", errorInfo.componentStack);

    if (isAuthError(error) && this.props.onAuthError) {
      this.props.onAuthError();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isAuthError: false });
  };

  render() {
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
 */
export function AuthErrorProvider({
  children,
  onAuthError,
}: {
  children: React.ReactNode;
  onAuthError?: () => void;
}) {
  const [hasAuthError, setHasAuthError] = useState(false);

  const reportAuthError = useCallback(
    (error: Error) => {
      if (isAuthError(error)) {
        console.log("[AuthErrorProvider] Auth error reported:", error.message);
        setHasAuthError(true);
        if (onAuthError) {
          onAuthError();
        }
      }
    },
    [onAuthError]
  );

  const clearAuthError = useCallback(() => {
    setHasAuthError(false);
  }, []);

  return (
    <AuthErrorContext.Provider value={{ reportAuthError, clearAuthError, hasAuthError }}>
      <AuthErrorBoundaryClass onAuthError={onAuthError}>
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
