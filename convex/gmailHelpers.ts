/**
 * Gmail helper functions - pure functions with no Convex dependencies.
 * These are used by gmailSync.ts and other Gmail-related actions.
 */

/**
 * Decode base64url-encoded data with proper UTF-8 support.
 * Gmail API returns body data in base64url format.
 */
export function decodeBase64Url(data: string): string {
  try {
    // Replace URL-safe characters
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    // Decode base64 to binary string
    const binaryString = atob(base64);
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Decode UTF-8
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Extract email body from Gmail payload.
 * Handles multipart messages recursively.
 */
export function extractBody(payload: any): { html: string; plain: string } {
  let html = "";
  let plain = "";

  // Check if body is directly in payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      html = decoded;
    } else {
      plain = decoded;
    }
  }

  // Check parts for multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        plain = decodeBase64Url(part.body.data);
      }
      // Recursively check nested parts
      if (part.parts) {
        const nested = extractBody(part);
        if (nested.html) html = nested.html;
        if (nested.plain && !plain) plain = nested.plain;
      }
    }
  }

  return { html, plain };
}

/**
 * Get a header value from Gmail message headers.
 * Case-insensitive lookup.
 */
export function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string {
  return (
    headers.find(
      (h: { name: string; value: string }) =>
        h.name.toLowerCase() === name.toLowerCase()
    )?.value || ""
  );
}

/**
 * Unfold email headers - remove CRLF + whitespace from folded headers.
 * RFC 2822 allows long headers to be "folded" across lines.
 */
export function unfold(s: string): string {
  return s.replace(/\r?\n\s+/g, "").trim();
}

/**
 * Simple delay helper for rate limiting.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse sender from "From" header.
 * Handles formats like:
 * - "Name <email@example.com>"
 * - "<email@example.com>"
 * - "email@example.com"
 */
export function parseSender(from: string): { name: string; email: string } {
  let senderName = "";
  let senderEmail = "";

  if (from) {
    // Try to match "Name <email>" or just "email"
    const fromMatch = from.match(
      /(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?/
    );
    if (fromMatch) {
      senderName = fromMatch[1]?.trim() || "";
      senderEmail = fromMatch[2] || from;
    } else {
      senderEmail = from;
    }
    // If name is empty but we have email, use email as name
    if (!senderName) {
      senderName = senderEmail;
    }
  }

  return { name: senderName, email: senderEmail };
}
