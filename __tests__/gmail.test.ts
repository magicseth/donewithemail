import { describe, it, expect } from "vitest";
import {
  parseEmailAddress,
  formatEmailAddress,
  parseGmailMessage,
  createRawEmail,
} from "../lib/gmail";

describe("Gmail Helpers", () => {
  describe("parseEmailAddress", () => {
    it("parses simple email address", () => {
      const result = parseEmailAddress("john@example.com");
      expect(result).toEqual({ email: "john@example.com" });
    });

    it("parses email with name", () => {
      const result = parseEmailAddress("John Doe <john@example.com>");
      expect(result).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("parses email with quoted name", () => {
      const result = parseEmailAddress('"John Doe" <john@example.com>');
      expect(result).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("normalizes email to lowercase", () => {
      const result = parseEmailAddress("John@EXAMPLE.COM");
      expect(result.email).toBe("john@example.com");
    });

    it("handles email without angle brackets", () => {
      const result = parseEmailAddress("john@example.com");
      expect(result).toEqual({ email: "john@example.com" });
    });
  });

  describe("formatEmailAddress", () => {
    it("formats email without name", () => {
      const result = formatEmailAddress("john@example.com");
      expect(result).toBe("john@example.com");
    });

    it("formats email with name", () => {
      const result = formatEmailAddress("john@example.com", "John Doe");
      expect(result).toBe('"John Doe" <john@example.com>');
    });
  });

  describe("parseGmailMessage", () => {
    it("parses a basic Gmail message", () => {
      const message = {
        id: "msg123",
        threadId: "thread456",
        snippet: "This is a preview...",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recipient@example.com" },
            { name: "Subject", value: "Test Subject" },
            { name: "Date", value: "Fri, 17 Jan 2026 12:00:00 -0800" },
          ],
          body: {
            data: "VGhpcyBpcyB0aGUgZW1haWwgYm9keQ==", // "This is the email body" base64
          },
        },
      };

      const result = parseGmailMessage(message);

      expect(result.id).toBe("msg123");
      expect(result.threadId).toBe("thread456");
      expect(result.from.email).toBe("sender@example.com");
      expect(result.to[0].email).toBe("recipient@example.com");
      expect(result.subject).toBe("Test Subject");
      expect(result.bodyPreview).toBe("This is a preview...");
    });

    it("handles missing subject", () => {
      const message = {
        id: "msg123",
        threadId: "thread456",
        snippet: "",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recipient@example.com" },
          ],
        },
      };

      const result = parseGmailMessage(message);
      expect(result.subject).toBe("(No subject)");
    });

    it("parses multiple recipients", () => {
      const message = {
        id: "msg123",
        threadId: "thread456",
        snippet: "",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "alice@example.com, bob@example.com" },
            { name: "Cc", value: "charlie@example.com" },
          ],
        },
      };

      const result = parseGmailMessage(message);

      expect(result.to).toHaveLength(2);
      expect(result.to[0].email).toBe("alice@example.com");
      expect(result.to[1].email).toBe("bob@example.com");
      expect(result.cc).toHaveLength(1);
      expect(result.cc![0].email).toBe("charlie@example.com");
    });
  });

  describe("createRawEmail", () => {
    it("creates a basic raw email", () => {
      const raw = createRawEmail({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "This is the body",
      });

      // Should be base64url encoded
      expect(raw).toBeTruthy();
      expect(raw).not.toContain("+");
      expect(raw).not.toContain("/");
      expect(raw).not.toContain("=");
    });

    it("includes reply headers when provided", () => {
      const raw = createRawEmail({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Re: Test Subject",
        body: "This is a reply",
        inReplyTo: "<original-message-id@example.com>",
        references: "<original-message-id@example.com>",
      });

      expect(raw).toBeTruthy();
    });
  });
});
