# Google OAuth Scope Justifications for DoneWith

Use these justifications when submitting for Google OAuth verification.

---

## Application Overview

**App Name:** DoneWith
**App Type:** AI-powered email management application
**Description:** DoneWith helps users efficiently manage their Gmail inbox through AI-powered summaries, urgency scoring, and swipe-based triage.

---

## Scope: `https://www.googleapis.com/auth/userinfo.email`

### Why We Need This Scope

This scope is required to identify the user's Google account.

1. **Account identification** - Determine which Google account the user is signing in with
2. **Multi-account support** - Distinguish between multiple linked Gmail accounts

### How It's Used

- During OAuth sign-in, we retrieve the user's email address
- Used to associate the user's data with their account
- Required to support linking multiple Gmail accounts

### User Control

- Standard scope required for any Google sign-in
- Minimal data access - only email address

---

## Scope: `https://www.googleapis.com/auth/userinfo.profile`

### Why We Need This Scope

This scope retrieves basic profile information for personalization.

1. **Display name** - Show the user's name in the app interface
2. **Profile picture** - Display avatar in account picker and settings
3. **Multi-account UX** - Help users distinguish between linked accounts

### How It's Used

- Profile picture displayed in account picker when composing emails
- User's name shown in settings and account management
- Helps identify which account is selected when multiple are linked

### User Control

- Standard scope for personalized experiences
- Only retrieves public profile information

---

## Scope: `https://www.googleapis.com/auth/gmail.readonly`

### Why We Need This Scope

DoneWith's core functionality is to display the user's Gmail inbox in a streamlined, AI-enhanced interface. We need read access to:

1. **Fetch email messages** - Display emails in our triage interface
2. **Read email content** - Generate AI summaries and urgency scores
3. **Access email metadata** - Show sender, subject, date, and labels
4. **Sync new emails** - Keep the inbox up-to-date in real-time

### How It's Used

- When users open DoneWith, we fetch their recent emails via the Gmail API
- Email content is sent to our AI service (Anthropic Claude) to generate summaries
- We display email metadata (from, subject, date) in the inbox view
- We periodically sync to detect new incoming emails

### User Control

- Users explicitly grant access during OAuth consent
- Users can view which emails we've accessed
- Users can revoke access at any time via Google Account settings

---

## Scope: `https://www.googleapis.com/auth/gmail.send`

### Why We Need This Scope

DoneWith includes email composition features that allow users to send emails directly from the app:

1. **Compose new emails** - Users can write and send new emails
2. **Reply to emails** - Users can reply to emails from the detail view
3. **Quick replies** - Users can send AI-suggested quick replies with one tap
4. **Reply All** - Users can reply to all recipients
5. **Forward emails** - Users can forward emails to others

### How It's Used

- User navigates to compose screen or taps "Reply" on an email
- User writes their message (or selects a quick reply suggestion)
- User explicitly taps "Send" button
- We construct the email via Gmail API and send it

### User Control

- **Emails are NEVER sent automatically** - Every send requires explicit user action
- Users see the full email content before sending
- Users choose the recipient and can edit any suggested content
- Send confirmation is shown after successful delivery

---

## Scope: `https://www.googleapis.com/auth/gmail.modify`

### Why We Need This Scope

DoneWith's triage workflow requires modifying email labels and read status:

1. **Archive emails** - When users swipe to mark as "Done", we archive the email in Gmail
2. **Update labels** - Apply labels based on triage actions (e.g., "DoneWith/Reply Needed")
3. **Mark as read** - Update read status when users view an email
4. **Sync triage state** - Keep Gmail's state consistent with DoneWith actions

### How It's Used

- User swipes right on an email to mark as "Done" → We remove it from INBOX label (archive)
- User marks email as "Reply Needed" → We apply a custom label
- User opens an email → We mark it as read in Gmail
- All modifications mirror the user's explicit actions

### User Control

- **Labels are only modified based on explicit user actions** (swipes, button taps)
- Users can see the result in Gmail immediately
- Actions are reversible - archived emails can be found in "All Mail"
- No bulk modifications without user consent

---

## Scope: `https://www.googleapis.com/auth/calendar`

### Why We Need This Scope

DoneWith detects calendar events mentioned in emails and can add them to the user's calendar.

1. **Calendar access** - View existing calendar to check for conflicts
2. **Event creation** - Add events detected in emails to the calendar

### How It's Used

- AI analyzes emails and detects mentioned events (meetings, appointments, deadlines)
- When user confirms, we create the event in their Google Calendar
- User reviews event details before creation

### User Control

- **Events are ONLY created when user explicitly confirms**
- User can edit event details before adding
- Users see a preview of the event before it's created

---

## Scope: `https://www.googleapis.com/auth/calendar.events`

### Why We Need This Scope

This scope is required alongside calendar scope to create and manage calendar events.

1. **Create events** - Add events from emails to user's calendar
2. **Event details** - Set title, time, location, description from email content

### How It's Used

- When user taps "Add to Calendar" on a detected event
- Event details are pre-filled from email content
- User confirms before event is created

### User Control

- All event creation requires explicit user action
- User can modify any auto-detected details
- No automatic event creation without user confirmation

---

## Scope: `https://www.googleapis.com/auth/contacts.readonly`

### Why We Need This Scope

DoneWith provides email address autocomplete when composing emails.

1. **Autocomplete** - Suggest contacts as user types recipient addresses
2. **Contact display** - Show contact names alongside email addresses

### How It's Used

- When user starts typing in the "To" field of compose screen
- We search user's contacts for matching email addresses
- Display suggestions for quick selection

### User Control

- **Read-only access** - We cannot modify contacts
- Only accessed when user is actively composing
- Contact data is not stored permanently

---

## Security Measures

1. **OAuth 2.0** - We use Google's secure OAuth flow; we never see or store Gmail passwords
2. **Token encryption** - Access and refresh tokens are encrypted at rest
3. **Minimal data retention** - Email content is processed for summaries, not stored long-term
4. **HTTPS everywhere** - All API communications use TLS encryption
5. **No third-party sharing** - Email data is never sold or shared

---

## Data Flow Diagram

```
User Action              →    DoneWith App       →    API Call
───────────────────────────────────────────────────────────────
Signs in                 →    Get identity       →    userinfo.email
                         →    Get profile        →    userinfo.profile
Opens inbox              →    Fetch emails       →    gmail.readonly
Views email              →    Get full body      →    gmail.readonly
                         →    Mark as read       →    gmail.modify
Swipes "Done"            →    Archive email      →    gmail.modify
Taps "Reply Needed"      →    Apply label        →    gmail.modify
Sends reply              →    Send email         →    gmail.send
Composes new email       →    Send email         →    gmail.send
Types in To field        →    Search contacts    →    contacts.readonly
Adds event to calendar   →    Create event       →    calendar + calendar.events
```

---

## Copy-Paste Scope Justifications

Use these when filling out the Google OAuth verification form:

---

**userinfo.email:**
```
DoneWith requires the user's email address to identify their account and support
multi-account functionality. Users can link multiple Gmail accounts, and we use
the email address to distinguish between them and associate data correctly.
```

**userinfo.profile:**
```
DoneWith displays the user's name and profile picture in the app interface,
particularly in the account picker when composing emails with multiple linked
accounts. This helps users identify which account they're using.
```

**gmail.readonly:**
```
DoneWith displays users' Gmail inbox in a mobile-optimized interface. We need
read access to: (1) fetch and display email messages, (2) read email content
for AI-powered summaries, (3) sync new incoming emails. Users explicitly view
each email they want to read. Email content is processed to generate summaries
but is not shared with third parties.
```

**gmail.send:**
```
DoneWith allows users to compose and send emails directly from the app. Users
can reply to emails, compose new messages, and use AI-suggested quick replies.
Emails are ONLY sent when users explicitly tap the Send button. We never send
emails automatically or without user action.
```

**gmail.modify:**
```
DoneWith's triage feature lets users swipe to archive emails or mark them for
follow-up. When a user swipes right to mark "Done", we archive the email by
removing the INBOX label. When users mark "Reply Needed", we apply a label.
All modifications directly correspond to explicit user actions in the app.
```

**calendar:**
```
DoneWith's AI detects calendar events mentioned in emails (meetings, deadlines,
appointments). When detected, users can add these events to their Google Calendar
with one tap. Calendar access allows us to create events. Events are ONLY created
when users explicitly confirm - never automatically.
```

**calendar.events:**
```
This scope works with calendar scope to create calendar events from emails.
When our AI detects an event in an email, users can review the pre-filled
event details and confirm before it's added to their calendar. Users can
edit any details before creation.
```

**contacts.readonly:**
```
DoneWith provides email address autocomplete when composing emails. As users
type in the recipient field, we search their Google Contacts to suggest
matching addresses. This is read-only access - we cannot modify contacts.
Contact data is only accessed during active composition and is not stored.
```

---

## Demo Video Script

When recording your OAuth verification demo video, show:

1. **OAuth Flow** (30 sec)
   - Show the Google sign-in button
   - Show consent screen with ALL scopes listed
   - Show successful authorization

2. **Profile Display** (15 sec)
   - Show user's name and avatar in the app (userinfo.email, userinfo.profile)

3. **Reading Emails** (60 sec)
   - Show inbox loading with emails (gmail.readonly)
   - Show AI summaries appearing
   - Show email detail view

4. **Triage Actions** (60 sec)
   - Swipe an email to archive (gmail.modify)
   - Mark an email as "Reply Needed" (gmail.modify)
   - Show the action reflected in Gmail

5. **Sending Emails** (60 sec)
   - Tap reply on an email
   - Show compose screen with contact autocomplete (contacts.readonly)
   - Type a recipient and show suggestions
   - Send an email (gmail.send)
   - Show confirmation

6. **Calendar Events** (45 sec)
   - Show an email with a detected event
   - Tap "Add to Calendar" (calendar, calendar.events)
   - Show event preview
   - Confirm and show success

7. **Multi-Account** (30 sec)
   - Show account picker with multiple accounts
   - Show profile pictures distinguishing accounts

8. **Revoking Access** (30 sec)
   - Show Settings screen
   - Mention Google Account permissions page
   - Show that data can be deleted

---

## Contact Information

For questions about our Gmail API usage:

- **Developer Email:** developer@donewithemail.com
- **Privacy Policy:** https://yourdomain.com/privacy
- **Terms of Service:** https://yourdomain.com/terms
