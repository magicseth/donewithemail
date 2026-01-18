/**
 * WorkOS Auth helpers
 */

export interface WorkOSUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

export interface AuthSession {
  user: WorkOSUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Get the full name from WorkOS user
 */
export function getFullName(user: WorkOSUser): string | undefined {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.firstName || user.lastName;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(expiresAt: number): boolean {
  // Add 5 minute buffer
  return Date.now() > expiresAt - 5 * 60 * 1000;
}

/**
 * WorkOS OAuth configuration
 */
export const WORKOS_CONFIG = {
  // These would come from environment variables
  clientId: process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID || "",
  redirectUri: process.env.EXPO_PUBLIC_WORKOS_REDIRECT_URI || "",
};

/**
 * Build OAuth authorization URL
 */
export function buildAuthUrl(options: {
  provider?: "GoogleOAuth";
  state?: string;
}): string {
  const params = new URLSearchParams({
    client_id: WORKOS_CONFIG.clientId,
    redirect_uri: WORKOS_CONFIG.redirectUri,
    response_type: "code",
    ...(options.provider && { provider: options.provider }),
    ...(options.state && { state: options.state }),
  });

  return `https://api.workos.com/sso/authorize?${params.toString()}`;
}

/**
 * Store for current auth state (in-memory for React Native)
 */
let currentSession: AuthSession | null = null;

export function setSession(session: AuthSession | null): void {
  currentSession = session;
}

export function getSession(): AuthSession | null {
  return currentSession;
}

export function clearSession(): void {
  currentSession = null;
}
