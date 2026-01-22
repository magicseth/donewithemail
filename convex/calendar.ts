"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// Build DoneWith attribution footer for calendar events
function buildDoneWithFooter(
  emailInfo: { subject?: string; fromName?: string; fromEmail?: string } | null
): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push("Scheduled by DoneWith");

  if (emailInfo) {
    if (emailInfo.fromName || emailInfo.fromEmail) {
      const sender = emailInfo.fromName
        ? `${emailInfo.fromName} <${emailInfo.fromEmail}>`
        : emailInfo.fromEmail;
      lines.push(`From: ${sender}`);
    }
    if (emailInfo.subject) {
      lines.push(`Subject: ${emailInfo.subject}`);
    }
  }

  return lines.join("\n");
}

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

    // Fetch email details if emailId provided (for attribution)
    let emailInfo: { subject?: string; fromName?: string; fromEmail?: string } | null = null;
    if (args.emailId) {
      emailInfo = await ctx.runQuery(internal.summarize.getEmailBasicInfo, {
        emailId: args.emailId,
      });
    }

    // Build description with DoneWith attribution
    let description = args.description || "";
    const donewithFooter = buildDoneWithFooter(emailInfo);
    if (donewithFooter) {
      description = description ? `${description}\n\n${donewithFooter}` : donewithFooter;
    }

    // Build event object with client's timezone
    const event: Record<string, unknown> = {
      summary: args.title,
      description,
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

/**
 * Check if a similar calendar event already exists
 * Returns matching events if found
 */
export const checkExistingCalendarEvents = action({
  args: {
    userEmail: v.string(),
    title: v.string(),
    startTime: v.optional(v.string()),
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{
    exists: boolean;
    similarEvents: Array<{
      id: string;
      title: string;
      startTime: string;
      htmlLink: string;
    }>;
  }> => {
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
      // Can't check calendar without token, return false to allow adding
      return { exists: false, similarEvents: [] };
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

      if (refreshed.refreshed) {
        await ctx.runMutation(internal.gmailSync.updateUserTokens, {
          userId: user._id,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
        });
      }
    }

    // Parse the start time to get a date range to search
    let searchTimeMin: string;
    let searchTimeMax: string;

    if (args.startTime) {
      const parsedStart = parseRelativeTime(args.startTime);
      if (parsedStart) {
        // Search ±1 day around the event time
        const startDate = new Date(parsedStart);
        const minDate = new Date(startDate);
        minDate.setDate(minDate.getDate() - 1);
        const maxDate = new Date(startDate);
        maxDate.setDate(maxDate.getDate() + 1);
        searchTimeMin = minDate.toISOString();
        searchTimeMax = maxDate.toISOString();
      } else {
        // Can't parse time, search next 30 days
        const now = new Date();
        searchTimeMin = now.toISOString();
        const maxDate = new Date(now);
        maxDate.setDate(maxDate.getDate() + 30);
        searchTimeMax = maxDate.toISOString();
      }
    } else {
      // No start time provided, search next 30 days
      const now = new Date();
      searchTimeMin = now.toISOString();
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + 30);
      searchTimeMax = maxDate.toISOString();
    }

    // Query Google Calendar for events in the time range
    const params = new URLSearchParams({
      timeMin: searchTimeMin,
      timeMax: searchTimeMax,
      singleEvents: "true",
      maxResults: "50",
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch calendar events:", await response.text());
      // On error, allow adding the event
      return { exists: false, similarEvents: [] };
    }

    const data = await response.json();
    const events = data.items || [];

    // Normalize the search title for comparison
    const normalizedSearchTitle = normalizeEventTitle(args.title);

    // Find similar events
    const similarEvents: Array<{
      id: string;
      title: string;
      startTime: string;
      htmlLink: string;
    }> = [];

    for (const event of events) {
      if (!event.summary) continue;

      const normalizedEventTitle = normalizeEventTitle(event.summary);

      // Check if titles are similar
      if (areTitlesSimilar(normalizedSearchTitle, normalizedEventTitle)) {
        // Also check if times are close (within 2 hours)
        const eventStart = event.start?.dateTime || event.start?.date;
        if (eventStart && args.startTime) {
          const parsedStart = parseRelativeTime(args.startTime);
          if (parsedStart) {
            const searchDate = new Date(parsedStart);
            const eventDate = new Date(eventStart);
            const hoursDiff = Math.abs(searchDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60);

            // Events within 2 hours with similar titles are considered duplicates
            if (hoursDiff <= 2) {
              similarEvents.push({
                id: event.id,
                title: event.summary,
                startTime: eventStart,
                htmlLink: event.htmlLink || "",
              });
            }
          }
        } else {
          // No time to compare, just use title match
          similarEvents.push({
            id: event.id,
            title: event.summary,
            startTime: event.start?.dateTime || event.start?.date || "",
            htmlLink: event.htmlLink || "",
          });
        }
      }
    }

    return {
      exists: similarEvents.length > 0,
      similarEvents,
    };
  },
});

/**
 * Normalize event title for comparison
 * Removes common prefixes/suffixes, extra whitespace, and lowercases
 */
function normalizeEventTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(re:|fwd:|fw:)\s*/gi, "") // Remove email prefixes
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .trim();
}

/**
 * Check if two normalized titles are similar
 * Uses word overlap to detect similarity
 */
function areTitlesSimilar(title1: string, title2: string): boolean {
  // Exact match
  if (title1 === title2) return true;

  // One contains the other
  if (title1.includes(title2) || title2.includes(title1)) return true;

  // Word overlap check
  const words1 = new Set(title1.split(" ").filter(w => w.length > 2));
  const words2 = new Set(title2.split(" ").filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return false;

  // Count overlapping words
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  // Consider similar if >50% word overlap
  const minWords = Math.min(words1.size, words2.size);
  return overlap >= minWords * 0.5;
}

/**
 * Batch add multiple calendar events from emails
 */
export const batchAddToCalendar = action({
  args: {
    userEmail: v.string(),
    emailIds: v.array(v.id("emails")),
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{
    added: Array<{ emailId: string; eventId: string; htmlLink: string }>;
    errors: Array<{ emailId: string; error: string }>;
  }> => {
    const added: Array<{ emailId: string; eventId: string; htmlLink: string }> = [];
    const errors: Array<{ emailId: string; error: string }> = [];

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

    // Process each email
    for (const emailId of args.emailIds) {
      try {
        // Get email summary with calendar event data
        const summaryData = await ctx.runQuery(internal.summarize.getSummary, {
          emailId,
        });

        if (!summaryData?.calendarEvent) {
          errors.push({ emailId, error: "No calendar event found" });
          continue;
        }

        // Skip if already added
        if (summaryData.calendarEventId) {
          added.push({
            emailId,
            eventId: summaryData.calendarEventId,
            htmlLink: summaryData.calendarEventLink || "",
          });
          continue;
        }

        const event = summaryData.calendarEvent;

        // Parse start and end times
        let startDateTime = event.startTime ? parseRelativeTime(event.startTime) : null;
        let endDateTime = event.endTime ? parseRelativeTime(event.endTime) : null;

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

        // Fetch email details for attribution
        const emailInfo = await ctx.runQuery(internal.summarize.getEmailBasicInfo, {
          emailId,
        });

        // Build description with DoneWith attribution
        let description = event.description || "";
        const donewithFooter = buildDoneWithFooter(emailInfo);
        if (donewithFooter) {
          description = description ? `${description}\n\n${donewithFooter}` : donewithFooter;
        }

        // Build event object
        const calendarEvent: Record<string, unknown> = {
          summary: event.title,
          description,
          start: {
            dateTime: startDateTime,
            timeZone: args.timezone,
          },
          end: {
            dateTime: endDateTime,
            timeZone: args.timezone,
          },
        };

        if (event.location) {
          calendarEvent.location = event.location;
        }

        if (event.recurrence) {
          calendarEvent.recurrence = [`RRULE:${event.recurrence}`];
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
            body: JSON.stringify(calendarEvent),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          errors.push({ emailId, error: `Failed to create event: ${error}` });
          continue;
        }

        const result = await response.json();

        // Save the calendar event ID to the email summary
        await ctx.runMutation(internal.summarize.markCalendarEventAdded, {
          emailId,
          calendarEventId: result.id,
          calendarEventLink: result.htmlLink,
        });

        added.push({
          emailId,
          eventId: result.id,
          htmlLink: result.htmlLink,
        });
      } catch (err) {
        errors.push({
          emailId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(`[BatchCalendar] Added ${added.length} events, ${errors.length} errors`);
    return { added, errors };
  },
});

/**
 * Check calendar availability for proposed meeting times
 * Returns whether each time slot has conflicts
 */
export const checkMeetingAvailability = action({
  args: {
    userEmail: v.string(),
    proposedTimes: v.array(v.object({
      startTime: v.string(),
      endTime: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<Array<{
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    conflicts: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      htmlLink: string;
    }>;
  }>> => {
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
      // Can't check calendar without token, return all as available
      return args.proposedTimes.map(time => ({
        ...time,
        isAvailable: true,
        conflicts: [],
      }));
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

      if (refreshed.refreshed) {
        await ctx.runMutation(internal.gmailSync.updateUserTokens, {
          userId: user._id,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
        });
      }
    }

    // Find the earliest and latest times to minimize API calls
    const allTimes = args.proposedTimes.flatMap(t => [
      new Date(parseRelativeTime(t.startTime) || t.startTime),
      new Date(parseRelativeTime(t.endTime) || t.endTime),
    ]);
    const minTime = new Date(Math.min(...allTimes.map(d => d.getTime())));
    const maxTime = new Date(Math.max(...allTimes.map(d => d.getTime())));

    // Query Google Calendar for events in the entire time range
    const params = new URLSearchParams({
      timeMin: minTime.toISOString(),
      timeMax: maxTime.toISOString(),
      singleEvents: "true",
      maxResults: "250",
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to fetch calendar events: ${error}`);
      // Return all as available on error
      return args.proposedTimes.map(time => ({
        ...time,
        isAvailable: true,
        conflicts: [],
      }));
    }

    const data = await response.json();
    const existingEvents = data.items || [];

    // Check each proposed time for conflicts
    return args.proposedTimes.map(proposedTime => {
      const proposedStart = new Date(parseRelativeTime(proposedTime.startTime) || proposedTime.startTime);
      const proposedEnd = new Date(parseRelativeTime(proposedTime.endTime) || proposedTime.endTime);

      const conflicts = existingEvents
        .filter((event: any) => {
          // Skip all-day events and events without start/end times
          if (!event.start?.dateTime || !event.end?.dateTime) return false;

          const eventStart = new Date(event.start.dateTime);
          const eventEnd = new Date(event.end.dateTime);

          // Check if events overlap
          // Two events overlap if: (StartA < EndB) and (EndA > StartB)
          return proposedStart < eventEnd && proposedEnd > eventStart;
        })
        .map((event: any) => ({
          id: event.id,
          title: event.summary || "(No title)",
          startTime: event.start.dateTime,
          endTime: event.end.dateTime,
          htmlLink: event.htmlLink,
        }));

      return {
        startTime: proposedTime.startTime,
        endTime: proposedTime.endTime,
        isAvailable: conflicts.length === 0,
        conflicts,
      };
    });
  },
});
