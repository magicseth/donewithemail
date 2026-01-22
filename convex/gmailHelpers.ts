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
 *
 * Handles Apple Mail's non-standard MIME structure where attachments are nested
 * inside multipart/alternative instead of at the top level:
 * - Standard: multipart/mixed → multipart/alternative → text/plain + text/html → attachment
 * - Apple Mail: multipart/alternative → text/plain → multipart/mixed → text/html + attachment
 *
 * See: https://bugzilla.mozilla.org/show_bug.cgi?id=1362539
 * See: https://github.com/mikel/mail/issues/590
 */
export function extractBody(payload: any): { html: string; plain: string } {
  const htmlParts: string[] = [];
  let plain = "";
  let hasAppleMailStructure = false;

  // Detect Apple Mail's unusual structure: multipart/alternative containing multipart/mixed
  if (payload.mimeType === "multipart/alternative" && payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "multipart/mixed") {
        hasAppleMailStructure = true;
        break;
      }
    }
  }

  function extractRecursive(part: any) {
    // Check if body is directly in this part
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/html") {
        htmlParts.push(decoded);
      } else if (part.mimeType === "text/plain") {
        // Keep the longest plain text part
        if (decoded.length > plain.length) {
          plain = decoded;
        }
      }
    }

    // Recursively check nested parts
    if (part.parts) {
      for (const subpart of part.parts) {
        extractRecursive(subpart);
      }
    }
  }

  extractRecursive(payload);

  // Choose the best HTML part - prefer the longest one
  let html = "";
  if (htmlParts.length > 0) {
    htmlParts.sort((a, b) => b.length - a.length);
    html = htmlParts[0];
  }

  // For Apple Mail structure OR when plain text has content not in HTML,
  // check if we should prefer plain text
  if (plain.length > 100 && html.length > 0) {
    // Get first line of plain text (the actual message, before quoted content)
    const plainLines = plain.split(/\r?\n/);
    const plainFirstLine = plainLines[0].trim();

    // Strip HTML tags for comparison
    const htmlText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Use plain text if:
    // 1. It's Apple Mail's non-standard structure, OR
    // 2. Plain text starts with substantial content (>20 chars) not found in HTML
    const plainHasUniqueContent = plainFirstLine.length > 20 &&
      !htmlText.toLowerCase().includes(plainFirstLine.substring(0, 50).toLowerCase());

    if (hasAppleMailStructure || plainHasUniqueContent) {
      // Convert plain text to basic HTML for display
      html = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(plain)}</pre>`;
    }
  }

  return { html, plain };
}

/**
 * Escape HTML special characters for safe display.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

/**
 * Attachment metadata extracted from Gmail payload.
 */
export type AttachmentInfo = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  contentId?: string;
};

/**
 * Extract attachment metadata from Gmail payload.
 * Returns list of attachments with their Gmail attachment IDs.
 * Does NOT download the actual file data - that's done separately via Gmail API.
 */
export function extractAttachments(payload: any): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  function processPayload(part: any) {
    // Check if this part is an attachment
    // Attachments have a filename and an attachmentId in the body
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
        contentId: part.headers
          ? getHeader(part.headers, "Content-ID")?.replace(/^<|>$/g, "")
          : undefined,
      });
    }

    // Recursively process nested parts
    if (part.parts) {
      for (const nested of part.parts) {
        processPayload(nested);
      }
    }
  }

  processPayload(payload);
  return attachments;
}
