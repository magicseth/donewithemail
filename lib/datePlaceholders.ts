/**
 * Date placeholder system for AI-generated summaries.
 *
 * The AI outputs dates as {{DATE:YYYY-MM-DD}} placeholders.
 * At display time, these are replaced with relative dates:
 * - "today" if the date matches today
 * - "yesterday" if the date was yesterday
 * - "tomorrow" if the date is tomorrow
 * - "Monday", "Tuesday", etc. if within the next 6 days
 * - "last Monday", etc. if within the past 6 days
 * - Otherwise the formatted date (e.g., "Jan 15" or "Jan 15, 2024" if different year)
 */

/**
 * Replace {{DATE:YYYY-MM-DD}} placeholders with relative date strings.
 *
 * @param text - Text containing date placeholders
 * @param timezone - IANA timezone string (e.g., "America/New_York"). Defaults to local timezone.
 * @returns Text with placeholders replaced by relative dates
 */
export function replaceDatePlaceholders(text: string, timezone?: string): string {
  if (!text) return text;

  // Match {{DATE:YYYY-MM-DD}} pattern
  const datePattern = /\{\{DATE:(\d{4}-\d{2}-\d{2})\}\}/g;

  return text.replace(datePattern, (_, dateStr: string) => {
    return formatRelativeDate(dateStr, timezone);
  });
}

/**
 * Format a date string as a relative date.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timezone - IANA timezone string
 * @returns Relative date string
 */
export function formatRelativeDate(dateStr: string, timezone?: string): string {
  // Parse the date - treat as local date in the target timezone
  const [year, month, day] = dateStr.split("-").map(Number);

  // Get "today" in the target timezone
  const now = new Date();
  const todayStr = timezone
    ? now.toLocaleDateString("en-CA", { timeZone: timezone }) // en-CA gives YYYY-MM-DD
    : now.toLocaleDateString("en-CA");

  const [todayYear, todayMonth, todayDay] = todayStr.split("-").map(Number);

  // Calculate days difference
  // Create dates at noon to avoid DST issues
  const targetDate = new Date(year, month - 1, day, 12, 0, 0);
  const todayDate = new Date(todayYear, todayMonth - 1, todayDay, 12, 0, 0);
  const diffMs = targetDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Relative date strings
  if (diffDays === 0) {
    return "today";
  } else if (diffDays === -1) {
    return "yesterday";
  } else if (diffDays === 1) {
    return "tomorrow";
  } else if (diffDays > 1 && diffDays <= 6) {
    // Within next 6 days - show day name
    return targetDate.toLocaleDateString("en-US", { weekday: "long" });
  } else if (diffDays < -1 && diffDays >= -6) {
    // Within past 6 days - show "last [day]"
    const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
    return `last ${dayName}`;
  } else {
    // More than a week away - show formatted date
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    if (year !== todayYear) {
      options.year = "numeric";
    }
    return targetDate.toLocaleDateString("en-US", options);
  }
}

/**
 * Check if text contains any date placeholders.
 */
export function hasDatePlaceholders(text: string): boolean {
  if (!text) return false;
  return /\{\{DATE:\d{4}-\d{2}-\d{2}\}\}/.test(text);
}
