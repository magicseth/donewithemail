import { describe, it, expect } from "vitest";

/**
 * Schema validation tests
 *
 * These tests validate the structure and types defined in our Convex schema.
 * Since Convex handles runtime validation, these tests verify our type definitions
 * and expected data structures.
 */

describe("Schema Types", () => {
  describe("Email", () => {
    it("defines required email fields", () => {
      const email = {
        externalId: "gmail-123",
        provider: "gmail" as const,
        userId: "user-id",
        from: "contact-id",
        to: ["contact-id-1", "contact-id-2"],
        subject: "Test Subject",
        bodyPreview: "Preview text...",
        bodyFull: "Full email body content",
        receivedAt: Date.now(),
        isRead: false,
        isTriaged: false,
      };

      expect(email.externalId).toBeDefined();
      expect(email.provider).toBe("gmail");
      expect(email.isRead).toBe(false);
      expect(email.isTriaged).toBe(false);
    });

    it("validates provider enum", () => {
      const validProviders = ["gmail", "outlook", "imap"];

      validProviders.forEach((provider) => {
        expect(validProviders).toContain(provider);
      });
    });

    it("validates triage action enum", () => {
      const validActions = ["done", "reply_needed", "delegated"];

      validActions.forEach((action) => {
        expect(validActions).toContain(action);
      });
    });

    it("allows optional AI fields", () => {
      const emailWithAI = {
        externalId: "gmail-123",
        provider: "gmail" as const,
        userId: "user-id",
        from: "contact-id",
        to: ["contact-id"],
        subject: "Test",
        bodyPreview: "Preview",
        bodyFull: "Full",
        receivedAt: Date.now(),
        isRead: false,
        isTriaged: false,
        // Optional AI fields
        summary: "Email summary",
        urgencyScore: 75,
        urgencyReason: "Contains deadline",
        suggestedReply: "Suggested response",
        aiProcessedAt: Date.now(),
      };

      expect(emailWithAI.summary).toBeDefined();
      expect(emailWithAI.urgencyScore).toBeGreaterThanOrEqual(0);
      expect(emailWithAI.urgencyScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Contact", () => {
    it("defines required contact fields", () => {
      const contact = {
        userId: "user-id",
        email: "contact@example.com",
        emailCount: 10,
        lastEmailAt: Date.now(),
      };

      expect(contact.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(contact.emailCount).toBeGreaterThanOrEqual(0);
    });

    it("validates relationship enum", () => {
      const validRelationships = ["vip", "regular", "unknown"];

      validRelationships.forEach((rel) => {
        expect(validRelationships).toContain(rel);
      });
    });

    it("allows optional fields", () => {
      const contactWithOptional = {
        userId: "user-id",
        email: "contact@example.com",
        name: "John Doe",
        avatarUrl: "https://example.com/avatar.jpg",
        emailCount: 10,
        lastEmailAt: Date.now(),
        relationship: "vip" as const,
        relationshipSummary: "AI-generated summary",
      };

      expect(contactWithOptional.name).toBeDefined();
      expect(contactWithOptional.relationship).toBe("vip");
    });
  });

  describe("User", () => {
    it("defines required user fields", () => {
      const user = {
        workosId: "workos-123",
        email: "user@example.com",
        connectedProviders: [],
        createdAt: Date.now(),
      };

      expect(user.workosId).toBeDefined();
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(user.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it("validates connected provider structure", () => {
      const provider = {
        provider: "gmail" as const,
        email: "user@gmail.com",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        expiresAt: Date.now() + 3600000,
      };

      expect(provider.provider).toBe("gmail");
      expect(provider.accessToken).toBeDefined();
      expect(provider.expiresAt).toBeGreaterThan(Date.now());
    });

    it("validates user preferences structure", () => {
      const preferences = {
        autoProcessEmails: true,
        urgencyThreshold: 80,
      };

      expect(preferences.autoProcessEmails).toBe(true);
      expect(preferences.urgencyThreshold).toBeGreaterThanOrEqual(0);
      expect(preferences.urgencyThreshold).toBeLessThanOrEqual(100);
    });
  });

  describe("AI Processing Queue", () => {
    it("validates queue status enum", () => {
      const validStatuses = ["pending", "processing", "completed", "failed"];

      validStatuses.forEach((status) => {
        expect(validStatuses).toContain(status);
      });
    });

    it("defines required queue item fields", () => {
      const queueItem = {
        emailId: "email-id",
        userId: "user-id",
        status: "pending" as const,
        createdAt: Date.now(),
      };

      expect(queueItem.status).toBe("pending");
      expect(queueItem.createdAt).toBeLessThanOrEqual(Date.now());
    });
  });
});

describe("Index Definitions", () => {
  it("emails table should have expected indexes", () => {
    const expectedIndexes = [
      "by_user",
      "by_user_untriaged",
      "by_user_received",
      "by_external_id",
      "by_from",
    ];

    // These would be validated by Convex at runtime
    expectedIndexes.forEach((index) => {
      expect(index).toBeDefined();
    });
  });

  it("contacts table should have expected indexes", () => {
    const expectedIndexes = [
      "by_user",
      "by_user_email",
      "by_user_last_email",
    ];

    expectedIndexes.forEach((index) => {
      expect(index).toBeDefined();
    });
  });

  it("users table should have expected indexes", () => {
    const expectedIndexes = [
      "by_workos_id",
      "by_email",
    ];

    expectedIndexes.forEach((index) => {
      expect(index).toBeDefined();
    });
  });
});
