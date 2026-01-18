/**
 * Gmail OAuth for web
 */

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

// Storage keys
const GMAIL_TOKEN_KEY = "gmail_access_token";
const GMAIL_REFRESH_TOKEN_KEY = "gmail_refresh_token";
const GMAIL_EXPIRY_KEY = "gmail_token_expiry";

export function getStoredGmailToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(GMAIL_TOKEN_KEY);
  const expiry = localStorage.getItem(GMAIL_EXPIRY_KEY);

  if (token && expiry && Date.now() < parseInt(expiry)) {
    return token;
  }
  return null;
}

export function storeGmailToken(accessToken: string, expiresIn: number): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(GMAIL_TOKEN_KEY, accessToken);
  localStorage.setItem(GMAIL_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearGmailToken(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(GMAIL_TOKEN_KEY);
  localStorage.removeItem(GMAIL_REFRESH_TOKEN_KEY);
  localStorage.removeItem(GMAIL_EXPIRY_KEY);
}

export function isGmailConnected(): boolean {
  return !!getStoredGmailToken();
}

export function initiateGmailOAuth(): void {
  const redirectUri = `${window.location.origin}/gmail-callback`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: GMAIL_SCOPES,
    include_granted_scopes: "true",
    prompt: "consent",
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function handleGmailCallback(): { success: boolean; error?: string } {
  if (typeof window === "undefined") return { success: false, error: "Not in browser" };

  // Parse the hash fragment for implicit grant flow
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const accessToken = params.get("access_token");
  const expiresIn = params.get("expires_in");
  const error = params.get("error");

  if (error) {
    return { success: false, error };
  }

  if (accessToken && expiresIn) {
    storeGmailToken(accessToken, parseInt(expiresIn));
    return { success: true };
  }

  return { success: false, error: "No token received" };
}

// Fetch emails from Gmail API
export async function fetchGmailMessages(maxResults: number = 20): Promise<any[]> {
  const token = getStoredGmailToken();
  if (!token) {
    throw new Error("Not authenticated with Gmail");
  }

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearGmailToken();
      throw new Error("Gmail token expired");
    }
    throw new Error(`Gmail API error: ${response.status}`);
  }

  const data = await response.json();
  return data.messages || [];
}

export async function fetchGmailMessage(messageId: string): Promise<any> {
  const token = getStoredGmailToken();
  if (!token) {
    throw new Error("Not authenticated with Gmail");
  }

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}
