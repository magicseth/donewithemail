import { describe, it, expect, beforeEach } from "vitest";
import {
  getFullName,
  isSessionExpired,
  setSession,
  getSession,
  clearSession,
  WorkOSUser,
  AuthSession,
} from "../lib/workos";

describe("WorkOS Helpers", () => {
  describe("getFullName", () => {
    it("returns full name when both first and last name exist", () => {
      const user: WorkOSUser = {
        id: "user123",
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      expect(getFullName(user)).toBe("John Doe");
    });

    it("returns first name only when last name is missing", () => {
      const user: WorkOSUser = {
        id: "user123",
        email: "john@example.com",
        firstName: "John",
      };

      expect(getFullName(user)).toBe("John");
    });

    it("returns last name only when first name is missing", () => {
      const user: WorkOSUser = {
        id: "user123",
        email: "john@example.com",
        lastName: "Doe",
      };

      expect(getFullName(user)).toBe("Doe");
    });

    it("returns undefined when neither name exists", () => {
      const user: WorkOSUser = {
        id: "user123",
        email: "john@example.com",
      };

      expect(getFullName(user)).toBeUndefined();
    });
  });

  describe("isSessionExpired", () => {
    it("returns false when session is not expired", () => {
      const expiresAt = Date.now() + 3600000; // 1 hour from now
      expect(isSessionExpired(expiresAt)).toBe(false);
    });

    it("returns true when session is expired", () => {
      const expiresAt = Date.now() - 1000; // 1 second ago
      expect(isSessionExpired(expiresAt)).toBe(true);
    });

    it("returns true when session expires within 5 minute buffer", () => {
      const expiresAt = Date.now() + 60000; // 1 minute from now (within 5 min buffer)
      expect(isSessionExpired(expiresAt)).toBe(true);
    });

    it("returns false when session expires after 5 minute buffer", () => {
      const expiresAt = Date.now() + 600000; // 10 minutes from now
      expect(isSessionExpired(expiresAt)).toBe(false);
    });
  });

  describe("Session management", () => {
    beforeEach(() => {
      clearSession();
    });

    it("sets and gets session", () => {
      const session: AuthSession = {
        user: {
          id: "user123",
          email: "john@example.com",
          firstName: "John",
        },
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      setSession(session);
      const retrieved = getSession();

      expect(retrieved).toEqual(session);
    });

    it("returns null when no session is set", () => {
      expect(getSession()).toBeNull();
    });

    it("clears session", () => {
      const session: AuthSession = {
        user: {
          id: "user123",
          email: "john@example.com",
        },
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      setSession(session);
      clearSession();

      expect(getSession()).toBeNull();
    });
  });
});
