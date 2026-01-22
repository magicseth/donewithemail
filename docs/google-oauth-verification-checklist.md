# Google OAuth Verification Checklist for DoneWith

Complete this checklist before submitting for Google OAuth verification.

---

## Phase 1: Prerequisites

### Domain Verification
- [ ] Own a domain (e.g., donewithemail.com)
- [ ] Add domain to Google Search Console
- [ ] Verify domain ownership (DNS TXT record or HTML file)
- [ ] Domain uses HTTPS

### Google Cloud Project Setup
- [ ] Create or select Google Cloud project
- [ ] Enable Gmail API in API Library
- [ ] Project is NOT in "Testing" mode when ready for verification

---

## Phase 2: Required Pages (Deploy These)

### Privacy Policy (/privacy)
- [ ] Deployed to your domain (NOT Google Docs)
- [ ] Mentions "Google" and "Gmail" explicitly
- [ ] Describes what Gmail data is accessed
- [ ] Explains how Gmail data is used
- [ ] States data is not sold to third parties
- [ ] Describes data retention policy
- [ ] Includes deletion/revocation instructions
- [ ] Lists third-party services (Anthropic, Convex, etc.)
- [ ] Includes contact email for privacy questions

### Terms of Service (/terms)
- [ ] Deployed to your domain
- [ ] Describes the service functionality
- [ ] Covers user responsibilities
- [ ] Includes limitation of liability
- [ ] Covers account termination

### Homepage (/home)
- [ ] Deployed to your domain
- [ ] Clear app name and description
- [ ] Explains what the app does
- [ ] Links to Privacy Policy
- [ ] Links to Terms of Service
- [ ] Professional appearance

---

## Phase 3: OAuth Consent Screen Configuration

### Basic Information
- [ ] App name: "DoneWith" (no "Google" or "Gmail" in name)
- [ ] User support email configured
- [ ] App logo uploaded (120x120 PNG, under 1MB)
- [ ] App homepage URL: https://yourdomain.com/home
- [ ] Privacy policy URL: https://yourdomain.com/privacy
- [ ] Terms of service URL: https://yourdomain.com/terms

### Scopes Configuration
- [ ] Only request scopes you actually use:
  - [ ] `userinfo.email` - for account identification
  - [ ] `userinfo.profile` - for name/avatar display
  - [ ] `gmail.readonly` - for reading emails
  - [ ] `gmail.send` - for sending emails
  - [ ] `gmail.modify` - for archiving/labeling
  - [ ] `calendar` - for calendar access
  - [ ] `calendar.events` - for creating events from emails
  - [ ] `contacts.readonly` - for email autocomplete
- [ ] Remove any unused scopes
- [ ] Each scope has clear justification written

### Developer Contact
- [ ] Developer contact email added
- [ ] Email is monitored and responsive

---

## Phase 4: Demo Video

### Video Requirements
- [ ] 2-5 minutes long
- [ ] Uploaded to YouTube (unlisted is OK)
- [ ] Shows complete OAuth flow
- [ ] Audio narration explaining each step
- [ ] Good video quality (720p minimum)

### Video Content Checklist
- [ ] Show: App landing page / homepage
- [ ] Show: Sign-in button clicked
- [ ] Show: Google OAuth consent screen with ALL 8 scopes
- [ ] Show: User granting permission
- [ ] Show: App receiving authorization
- [ ] Demo: User profile displayed (userinfo.email, userinfo.profile)
- [ ] Demo: Inbox loading and displaying emails (gmail.readonly)
- [ ] Demo: Opening an email to read content (gmail.readonly)
- [ ] Demo: AI summary feature (explain this uses email content)
- [ ] Demo: Archiving/triaging an email (gmail.modify)
- [ ] Demo: Composing a new email with contact autocomplete (contacts.readonly)
- [ ] Demo: Sending the email (gmail.send)
- [ ] Demo: Detecting a calendar event in an email
- [ ] Demo: Adding event to calendar (calendar, calendar.events)
- [ ] Demo: Multi-account picker showing avatars (userinfo.profile)
- [ ] Show: How user can revoke access
- [ ] Explain: Data handling and privacy

### Video Script Template
```
"Hi, this is a demo of DoneWith, an AI-powered email management app.

[Show homepage]
DoneWith helps users manage their Gmail inbox efficiently using AI.

[Click Sign In]
Users sign in with their Google account. Let me click Sign In.

[Show consent screen]
Here's the consent screen. We request three permissions:
- Read access to display emails
- Send access so users can reply
- Modify access to archive emails when users triage them

[Grant permission]
The user reviews and grants permission.

[Show inbox]
Now we're in the app. Emails load from Gmail using read access.
Our AI generates summaries to help users process emails faster.

[Open an email]
When I tap an email, we fetch the full content to display it.

[Swipe to archive]
Swiping right archives the email - this uses modify access.

[Compose reply]
Tapping reply opens the compose screen.
[Type and send]
When I tap Send, the email is sent via Gmail's API.

[Show settings]
Users can revoke access anytime in their Google Account settings
or delete their DoneWith account here.

Thank you for reviewing DoneWith."
```

---

## Phase 5: Submission Materials

### Scope Justifications (Copy-Paste Ready)

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

---

## Phase 6: Security Assessment (Restricted Scopes)

Since gmail.send and gmail.modify are restricted scopes, you'll need a security assessment.

### Options

**Option A: CASA Tier 2 (Self-Assessment)**
- For apps with limited users
- Complete security questionnaire
- Free but may require documentation

**Option B: Letter of Assessment (LOA)**
- Third-party security firm review
- Cost: $4,000 - $8,000
- Timeline: 2-4 weeks
- Approved assessors: Bishop Fox, Leviathan, NCC Group

**Option C: Full Security Audit**
- Comprehensive penetration testing
- Cost: $15,000+
- Timeline: 4-8 weeks

### Security Questionnaire Prep
- [ ] Document your authentication flow
- [ ] Document data encryption (at rest and in transit)
- [ ] Document access controls
- [ ] Document incident response plan
- [ ] No known security vulnerabilities
- [ ] HTTPS on all endpoints
- [ ] Tokens stored securely (encrypted)

---

## Phase 7: Submission

### Before Submitting
- [ ] All URLs are live and accessible
- [ ] Privacy Policy mentions Gmail data specifically
- [ ] Demo video is uploaded and URL works
- [ ] All scope justifications written
- [ ] Test the OAuth flow end-to-end
- [ ] Remove any test/debug code

### Submit at
Google Cloud Console → APIs & Services → OAuth consent screen → "Submit for verification"

### What to Expect
1. **Acknowledgment** - Within 1-2 business days
2. **Initial Review** - 1-2 weeks
3. **Feedback/Questions** - Respond promptly
4. **Security Assessment** (if restricted scopes) - 4-12 weeks
5. **Final Approval** - 1-2 weeks after assessment

### Common Rejection Reasons & Fixes
| Rejection Reason | Fix |
|------------------|-----|
| Privacy policy doesn't mention Google/Gmail | Add explicit Gmail data section |
| Demo video too short | Make it 3-5 minutes, show full flow |
| Requesting unused scopes | Audit code and remove unused scopes |
| App name contains "Gmail" | Rename to something without Google trademarks |
| Inconsistent branding | Use same name/logo everywhere |
| No homepage | Create /home page |

---

## Quick Reference URLs

- **OAuth Consent Screen:** https://console.cloud.google.com/apis/credentials/consent
- **API Library:** https://console.cloud.google.com/apis/library
- **Search Console:** https://search.google.com/search-console
- **Verification Status:** https://console.cloud.google.com/apis/credentials/consent
- **CASA Information:** https://developers.google.com/apps-script/guides/client-verification

---

## Post-Verification

After approval:
- [ ] Monitor for any Google policy update emails
- [ ] Respond promptly to any compliance requests
- [ ] Keep Privacy Policy updated if features change
- [ ] Annual review of scope usage

---

## Timeline Estimate

| Phase | Timeline |
|-------|----------|
| Setup & Pages | 1-2 days |
| Demo Video | 1 day |
| Submit | 1 day |
| Initial Review | 1-2 weeks |
| Security Assessment | 4-12 weeks |
| **Total** | **6-16 weeks** |

---

**Tip:** Start the security assessment process early - it's usually the longest wait.
