import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for new emails every minute
crons.interval(
  "check-new-emails",
  { minutes: 1 },
  internal.emailSync.checkNewEmailsForAllUsers
);

export default crons;
