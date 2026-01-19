"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Refresh access token if expired
async function refreshTokenIfNeeded(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<{ accessToken: string; expiresAt: number; refreshed: boolean }> {
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken, expiresAt, refreshed: false };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshed: true,
  };
}

// Parse relative time strings like "next Tuesday 2pm" to local datetime
function parseRelativeTime(timeStr: string): string | null {
  if (!timeStr) return null;

  // If it's already a local datetime string (no Z suffix), return it
  if (timeStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/) && !timeStr.includes("Z")) {
    return timeStr;
  }

  // If it's an ISO string with Z, convert to local format
  if (timeStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return formatLocalDateTime(date);
    }
  }

  // Try to parse with Date
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    return formatLocalDateTime(date);
  }

  // Handle relative dates like "next Tuesday", "tomorrow", etc.
  const now = new Date();
  const lowerStr = timeStr.toLowerCase();

  if (lowerStr.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return extractTimeAndSetDate(tomorrow, timeStr);
  }

  // Handle "next [day]"
  const dayMatch = lowerStr.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysUntil);
    return extractTimeAndSetDate(targetDate, timeStr);
  }

  return null;
}

// Format date as local datetime string (no timezone) for Google Calendar
function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// Extract time from string and set on date
function extractTimeAndSetDate(date: Date, timeStr: string): string {
  // Look for time patterns like "2pm", "2:30pm", "14:00"
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();

    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    date.setHours(hours, minutes, 0, 0);
  } else {
    // Default to 9am if no time specified
    date.setHours(9, 0, 0, 0);
  }

  // Return local time string without timezone (Google will use the specified timezone)
  return formatLocalDateTime(date);
}

// Add event to Google Calendar
export const addToCalendar = action({
  args: {
    userEmail: v.string(),
    title: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    timezone: v.string(), // Client's timezone e.g. "America/New_York"
    emailId: v.optional(v.id("emails")),
    // Recurrence rule in RRULE format (without "RRULE:" prefix)
    // e.g., "FREQ=WEEKLY;BYDAY=TU" for every Tuesday
    recurrence: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ eventId: string; htmlLink: string }> => {
    // Get user's tokens
    type UserWithTokens = {
      _id: any;
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
      gmailTokenExpiresAt?: number;
    };
    const user: UserWithTokens | null = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Google account not connected");
    }

    // Refresh token if needed
    let accessToken: string = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        user.gmailAccessToken,
        user.gmailRefreshToken,
        user.gmailTokenExpiresAt
      );
      accessToken = refreshed.accessToken;

      // Save refreshed token to database
      if (refreshed.refreshed) {
        await ctx.runMutation(internal.gmailSync.updateUserTokens, {
          userId: user._id,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
        });
      }
    }

    // Parse start and end times
    let startDateTime = args.startTime ? parseRelativeTime(args.startTime) : null;
    let endDateTime = args.endTime ? parseRelativeTime(args.endTime) : null;

    // Default to tomorrow 9am if no start time
    if (!startDateTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      startDateTime = formatLocalDateTime(tomorrow);
    }

    // Default to 1 hour after start if no end time
    if (!endDateTime) {
      const endDate = new Date(startDateTime);
      endDate.setHours(endDate.getHours() + 1);
      endDateTime = formatLocalDateTime(endDate);
    }

    // Build event object with client's timezone
    const event: Record<string, unknown> = {
      summary: args.title,
      description: args.description || "",
      start: {
        dateTime: startDateTime,
        timeZone: args.timezone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: args.timezone,
      },
    };

    // Add location if provided
    if (args.location) {
      event.location = args.location;
    }

    // Add recurrence rule for repeating events
    // Google Calendar expects an array of RRULE strings with the "RRULE:" prefix
    if (args.recurrence) {
      event.recurrence = [`RRULE:${args.recurrence}`];
    }

    // Create event via Google Calendar API
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create calendar event: ${error}`);
    }

    const result = await response.json();

    // Save the calendar event ID to the email summary
    if (args.emailId) {
      await ctx.runMutation(internal.summarize.markCalendarEventAdded, {
        emailId: args.emailId,
        calendarEventId: result.id,
        calendarEventLink: result.htmlLink,
      });
    }

    return {
      eventId: result.id,
      htmlLink: result.htmlLink,
    };
  },
});
