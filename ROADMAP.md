# DoneWith Roadmap

## Philosophy

**"Say Less, Do More"** - Get through email faster by letting AI do the reading so you can focus on deciding.

- **Swipe, Don't Read** - TikTok-style gesture triage turns emails into quick decisions
- **AI as Your First Pass** - Claude extracts what matters: asks, urgency, events, deadlines
- **One-Tap Actions** - Calendar adds, quick replies, voice responses
- **Triage Over Organization** - No folders, no labels. Just: Done, Reply, or Delegate

### The Three Buckets

Every email falls into one of three buckets based on what it demands from you:

| Bucket | What it is | Examples | Goal |
|--------|-----------|----------|------|
| **Informational** | Just need to know, no action | Receipts, shipping updates, newsletters, FYIs | Swipe through fast, absorb passively |
| **Immediate** | Quick action, <30 seconds | Accept meeting, quick reply, approve request | Handle in-app, right now |
| **Deep Work** | Needs time, thought, or resources | Thoughtful reply, gather docs, review proposal | Queue for later, do at desk |

The AI classifies each email. The UI adapts:
- **Informational** → optimized for fast scanning, auto-archive option
- **Immediate** → quick reply chips, one-tap actions prominent
- **Deep Work** → save to dedicated queue, surface when you have time

---

## Now: Core Loop Polish

### Three Buckets Classification
- [ ] AI classifies emails: Informational / Immediate / Deep Work
- [ ] Visual indicator in inbox row (subtle icon or color)
- [ ] Filter views: "Just info" / "Quick actions" / "Deep work queue"
- [ ] Auto-archive option for informational (swipe past = done)

### Triage Feel
- [ ] Haptic feedback tuning for target hits
- [ ] Ball physics improvements (momentum, snap-back)
- [ ] Undo toast (5-second window to reverse accidental triage)

### AI Quality
- [ ] Better calendar event parsing (timezone edge cases)
- [ ] Smarter quick reply tone matching
- [ ] Thread-aware summaries (know what was already discussed)

### Reliability
- [ ] Offline queue for triage actions
- [ ] Better auth error recovery
- [ ] Background sync improvements

---

## Next: Never Miss What Matters

### VIP Protection
Emails from VIP contacts can't be scroll-triaged as "done" - require explicit swipe. Prevents accidentally archiving important messages from key people.

### Snooze Target
New triage target that hides the email until later (tonight, tomorrow, next week). Resurfaces in inbox when the time comes.

### Unanswered Thread Detection
If you sent a message and haven't heard back in X days, surface it as a follow-up reminder. Catch dropped conversations.

### Weekly Review
Quick digest of emails you triaged as "done" from important senders that you never responded to. Safety net for things that slipped through.

---

## Later: Say Even Less

### Voice-First Mode
Full voice triage: "Archive... Reply yes sounds good... Skip... Calendar add..." Process inbox eyes-free while walking or driving.

### Smart Auto-Triage
AI pre-triages obvious stuff:
- Informational emails from known senders → auto-archive
- Meeting invites from team → auto-accept (with notification)
- Newsletters → batch into daily digest
You just review exceptions.

### Reply Drafts
When you hit "Reply", AI drafts a full response based on context. Edit or send as-is.
- **Immediate** emails: one-liner drafts, send in <10 seconds
- **Deep Work** emails: fuller drafts with context, edit at desk

### Deep Work Mode
Dedicated view for emails that need real thought:
- Distraction-free compose with AI assistance
- "Gather context" button pulls related emails/attachments
- Timer/focus mode for batching replies
- Desktop-optimized (these shouldn't be done on phone)

### Delegate Flow
"Delegate to Sarah" creates a forwarded email with AI-generated context summary. Track delegation status.

### Calendar Intelligence
- Detect scheduling conflicts before you accept
- Suggest optimal meeting times based on your calendar
- Auto-decline obvious spam invites

---

## Future: Beyond Email

### Multi-Account
Unified triage across personal + work Gmail accounts. One inbox to rule them all.

### Other Inboxes
- Slack DMs
- LinkedIn messages
- Twitter/X DMs
- SMS (via forwarding)

Same swipe-to-triage UX, same AI summaries. All your inboxes, one gesture-based flow.

### Team Features
- Shared triage queues (support@, sales@)
- Assignment and handoff
- Response time tracking

---

## Implemented

- [x] Swipe-to-triage with ball physics
- [x] AI email summaries (<240 chars)
- [x] Quick reply chips
- [x] Calendar event extraction + one-tap add
- [x] Voice reply recording
- [x] Urgency scoring + push notifications
- [x] Deadline extraction
- [x] Reply-needed reminders (24-48h)
- [x] Subscription detection + unsubscribe target
- [x] Accept calendar target for meeting invites
