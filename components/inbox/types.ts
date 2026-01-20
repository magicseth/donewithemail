/**
 * Type definitions and configuration for the inbox screen.
 */
import type { QuickReply, CalendarEvent } from "../../hooks/useGmail";

// Triage UI configuration - all positioning driven from these values
export const TRIAGE_CONFIG = {
  // Estimated height of each email row
  rowHeight: 140,
  // Height of header elements above the list (swipe hint ~34 + search ~52)
  headerOffset: 86,
  // Padding at top of list (gives runway before first email)
  get listTopPadding() { return this.rowHeight; },
  // Ball size
  ballSize: 32,
  // How much the ball moves relative to finger movement
  ballTravelMultiplier: 1.5,
};

/**
 * Inbox email type - normalized email data for display.
 */
export interface InboxEmail {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  urgencyScore?: number;
  summary?: string;
  quickReplies?: QuickReply[];
  calendarEvent?: CalendarEvent;
  shouldAcceptCalendar?: boolean;
  threadCount?: number;
  isSubscription?: boolean;
  fromName?: string; // Sender name as it appeared in this email
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
}

/**
 * Reply draft state for the review modal.
 */
export interface ReplyDraft {
  email: InboxEmail;
  body: string;
  subject: string;
}

/**
 * Inbox mode - swipe for triage UI, batch for AI batch processing.
 */
export type InboxMode = "swipe" | "batch";
