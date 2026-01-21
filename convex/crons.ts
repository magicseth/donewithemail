import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for new emails every minute
crons.interval(
  "check-new-emails",
  { minutes: 1 },
  internal.emailSync.checkNewEmailsForAllUsers
);

// Check for stale reply_needed emails and upcoming deadlines every hour
crons.interval(
  "check-reminders",
  { hours: 1 },
  internal.reminders.checkAndSendReminders
);

// Update AI pricing data daily (fetches from models.dev)
crons.daily(
  "update-ai-pricing",
  { hourUTC: 6, minuteUTC: 0 }, // 6am UTC
  internal.costs.refreshPricingData
);

export default crons;
