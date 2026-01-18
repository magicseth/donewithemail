/**
 * Gmail API helpers
 */

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function parseEmailAddress(raw: string): { name?: string; email: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^\s<>]+@[^\s<>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2].toLowerCase(),
    };
  }
  return { email: raw.toLowerCase().trim() };
}

export function formatEmailAddress(email: string, name?: string): string {
  if (name) {
    return `"${name}" <${email}>`;
  }
  return email;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: { email: string; name?: string };
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  subject: string;
  bodyPreview: string;
  bodyFull: string;
  receivedAt: number;
}

export function parseGmailMessage(message: any): GmailMessage {
  const headers = message.payload?.headers || [];

  const getHeader = (name: string): string => {
    const header = headers.find(
      (h: any) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
  };

  const from = parseEmailAddress(getHeader("From"));
  const toRaw = getHeader("To");
  const ccRaw = getHeader("Cc");
  const subject = getHeader("Subject") || "(No subject)";

  const to = toRaw
    .split(",")
    .map((addr: string) => addr.trim())
    .filter(Boolean)
    .map(parseEmailAddress);

  const cc = ccRaw
    ? ccRaw.split(",").map((addr: string) => addr.trim()).filter(Boolean).map(parseEmailAddress)
    : undefined;

  const bodyPreview = message.snippet || "";
  const bodyFull = extractBodyContent(message.payload);

  const dateHeader = getHeader("Date");
  const receivedAt = dateHeader ? new Date(dateHeader).getTime() : Date.now();

  return { id: message.id, threadId: message.threadId, from, to, cc, subject, bodyPreview, bodyFull, receivedAt };
}

function extractBodyContent(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }

    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return stripHtml(decodeBase64Url(htmlPart.body.data));
    }

    for (const part of payload.parts) {
      if (part.parts) {
        const content = extractBodyContent(part);
        if (content) return content;
      }
    }
  }

  return "";
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    if (typeof atob !== "undefined") {
      return decodeURIComponent(
        atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
    }
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return encoded;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createRawEmail(options: {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (options.inReplyTo) headers.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) headers.push(`References: ${options.references}`);

  const email = `${headers.join("\r\n")}\r\n\r\n${options.body}`;

  if (typeof btoa !== "undefined") {
    return btoa(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(email).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface GmailClientConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function gmailApiRequest(
  endpoint: string,
  config: GmailClientConfig,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = "https://gmail.googleapis.com/gmail/v1/users/me";

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error("Token expired - refresh needed");
  }

  return response;
}
