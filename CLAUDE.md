# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sayless is an AI-powered email triage app with TikTok-style swiping interface. Built with React Native (Expo) + Convex serverless backend.

## Development Commands

```bash
# Start all services for development
npx expo start --web          # Frontend dev server
npx convex dev                # Backend (auto-deploys on save)
npx tsc --watch --noEmit      # Type checking

# Deploy Convex manually
npx convex dev --once

# Run tests
npm test                      # Single run with Vitest
npm run test:watch            # Watch mode

# Build for mobile
eas build --platform ios
eas build --platform android
```

## Architecture

### Tech Stack
- **Frontend**: React Native 0.81 + Expo 54, expo-router (file-based routing)
- **Backend**: Convex (real-time serverless with workflows)
- **Auth**: WorkOS (handles Google OAuth, provides Gmail tokens)
- **AI**: Claude Sonnet 4 via @ai-sdk/anthropic for summarization
- **Push**: expo-notifications + @convex-dev/expo-push-notifications

### Data Flow

```
Gmail API → emailSync.ts → emails table → Real-time Convex queries → UI
                ↓
        emailWorkflow.ts (multi-step)
                ↓
        summarizeActions.ts (Claude AI)
                ↓
        emailSummaries table → urgencyScore ≥70 → Push notification
```

### Key Convex Files

| File | Purpose |
|------|---------|
| `schema.ts` | Database tables: users, emails, emailSummaries, contacts, aiProcessingQueue |
| `emailSync.ts` | Gmail API integration, token refresh, fetch/store emails |
| `emailWorkflow.ts` | Orchestrated email processing: fetch → store → summarize → notify |
| `summarizeActions.ts` | Claude AI analysis: summary, urgency, quick replies, calendar events |
| `missedTodos.ts` | Workflow to detect emails needing response |
| `missedTodosWorkflow.ts` | AI action for batch email analysis (Node.js runtime) |
| `notifications.ts` | Push notification registration and sending |
| `crons.ts` | Background job: checks new emails every 1 minute |
| `auth.ts` | WorkOS OAuth flow, token exchange |

### App Screens (expo-router)

| Route | Screen |
|-------|--------|
| `(tabs)/index.tsx` | TODOs list - emails marked reply_needed |
| `(tabs)/inbox.tsx` | Inbox with auto-triage on scroll |
| `(tabs)/settings.tsx` | Sign in, preferences |
| `email/[id].tsx` | Email detail with AI summary |
| `callback.tsx` | WorkOS OAuth callback handler |

### Email Triage States

- `isTriaged: false` → Appears in inbox
- `triageAction: "done"` → Archived (scroll past or swipe)
- `triageAction: "reply_needed"` → Appears in TODOs
- `triageAction: "delegated"` → Delegated

## Key Patterns

### Convex Workflows vs Actions
Use `workflow.define()` for multi-step operations that need reliability:
```typescript
export const processEmails = workflow.define({
  handler: async (step, args) => {
    await step.runAction(internal.x.fetch, {...});
    await step.runMutation(internal.x.store, {...});
  }
});
```

### Node.js Actions
Files with `"use node";` at top run in Node.js (required for AI SDK). Cannot export mutations - split into separate files.

### Convex Query Skip Pattern
```typescript
const result = useQuery(api.x.get, id ? { id } : "skip");
```

### Optimistic UI Updates
```typescript
setProcessedIds(prev => new Set(prev).add(id));
try {
  await mutation();
} catch {
  setProcessedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
}
```

### Swipe Gestures (Web)
```typescript
Gesture.Pan()
  .mouseButton(MouseButton.LEFT)           // Enable left-click drag
  .enableTrackpadTwoFingerGesture(true)    // Trackpad support
  .activeOffsetX(15)                       // Activation threshold
  .failOffsetY([-15, 15])                  // Cancel if vertical
```

## Schema Indexes

Important for query performance:
- `emails.by_external_id` - Gmail message ID lookup
- `emails.by_thread` - Thread grouping
- `emails.by_user_untriaged` - Inbox query (userId + isTriaged)
- `contacts.by_user_email` - Contact lookup

## Authentication Flow

1. User clicks sign in → `auth.getAuthUrl()` generates WorkOS URL with Gmail scopes
2. WorkOS handles Google OAuth, redirects to `/callback`
3. `auth.authenticate()` exchanges code → gets user info + Google tokens
4. Tokens stored in `users` table (gmailAccessToken, gmailRefreshToken)

**Important**: Google OAuth tokens are ONLY in the initial authenticate response, not on subsequent user fetches.

## AI Integration

### Summarization (summarizeActions.ts)
- Model: `claude-sonnet-4-20250514`
- Returns: summary, urgencyScore (0-100), actionRequired, quickReplies, calendarEvent

### Missed TODOs Detection (missedTodosWorkflow.ts)
- Batch processes 10 emails at a time
- Filters: newsletters, marketing, automated, no-reply addresses
- Only flags: personal emails with direct questions expecting reply
- Conservative: defaults to "no response needed" when uncertain

## Debugging

- **Convex logs**: Check dashboard at https://dashboard.convex.dev
- **Gesture handlers**: Use `runOnJS(console.log)(data)` (they run on UI thread)
- **Triage logging**: Server logs `[Triage] Action: done | Subject: "..."` on each triage

## Environment Variables

Required in Convex dashboard or `.env.local`:
- `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
