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
| `schema.ts` | Database tables: users, emails, emailBodies, emailSummaries, contacts, subscriptions, featureRequests |
| `emailSync.ts` | Gmail API integration, token refresh, fetch/store emails |
| `emailWorkflow.ts` | Orchestrated email processing: fetch → store → summarize → notify |
| `summarizeActions.ts` | Claude AI analysis: summary, urgency, quick replies, calendar events |
| `missedTodos.ts` | Workflow to detect emails needing response |
| `missedTodosWorkflow.ts` | AI action for batch email analysis (Node.js runtime) |
| `notifications.ts` | Push notification registration and sending |
| `crons.ts` | Background job: checks new emails every 1 minute |
| `auth.ts` | WorkOS OAuth flow, token exchange |
| `gmailAuth.ts` | Direct Gmail OAuth (separate from WorkOS) |
| `subscriptions.ts` | Newsletter/subscription management and unsubscribe |
| `voice.ts` | Deepgram API key for voice transcription |
| `featureRequests.ts` | Voice-driven feature request tracking |
| `agents/` | Convex Agent definitions for summarizer, autoResponder, emailQA |
| `convex.config.ts` | Component registration: agent, migrations, pushNotifications, workpool, workflow |

### App Screens (expo-router)

| Route | Screen |
|-------|--------|
| `(tabs)/index.tsx` | Inbox with AI batch triage interface |
| `(tabs)/todos.tsx` | TODOs list - emails marked reply_needed |
| `(tabs)/ask.tsx` | AI chat interface for email questions |
| `(tabs)/settings.tsx` | Sign in, preferences |
| `email/[id].tsx` | Email detail with AI summary |
| `person/[id].tsx` | Contact detail with facts/dossier |
| `subscriptions.tsx` | Manage newsletter subscriptions |
| `compose.tsx` | Compose new email |
| `callback.tsx` | WorkOS OAuth callback handler |
| `gmail-callback.tsx` | Direct Gmail OAuth callback |

### Email Triage States

- `isTriaged: false` → Appears in inbox
- `triageAction: "done"` → Archived (scroll past or swipe)
- `triageAction: "reply_needed"` → Appears in TODOs
- `triageAction: "delegated"` → Delegated

### Demo Mode

The app has a demo mode that works without authentication, using generated sample data:
- Enter via "Try Demo" button on sign-in screen
- Uses `DemoModeProvider` context (`lib/demoModeContext.tsx`)
- Generates fake contacts, emails, and summaries in `lib/demoMode.ts`
- Hooks check `isDemoMode` to return demo data instead of querying Convex

### Email Body Storage

Email bodies are stored separately from email metadata to keep queries fast:
- `emails` table: metadata only (subject, from, to, preview)
- `emailBodies` table: full body content, HTML, raw payload
- Joined on read via `emailBodies.by_email` index

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

### Convex Components
This project uses several `@convex-dev` components configured in `convex.config.ts`:
- `@convex-dev/agent` - AI agent framework for email Q&A
- `@convex-dev/workflow` - Multi-step reliable workflows
- `@convex-dev/workpool` - Job queue management
- `@convex-dev/expo-push-notifications` - Push notification handling
- `@convex-dev/migrations` - Database migrations

## Schema Indexes

Important for query performance:
- `emails.by_external_id` - Gmail message ID lookup
- `emails.by_thread` - Thread grouping
- `emails.by_user_untriaged` - Inbox query (userId + isTriaged + receivedAt)
- `emails.by_user_reply_needed` - TODOs query (userId + triageAction + triagedAt)
- `contacts.by_user_email` - Contact lookup
- `emailBodies.by_email` - Join body to email
- `emailSummaries.by_embedding` - Vector search for semantic email queries

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
- **Demo mode logging**: Prefixed with `[DemoMode]` in console

## React Native Reanimated Gotchas

### Worklet Serialization Issue
**CRITICAL**: When you pass a function to `runOnJS()` or use it in `useAnimatedReaction`, Reanimated **serializes** any captured variables (including refs). Subsequent updates to `ref.current` won't be seen by the worklet.

**Wrong** - ref gets serialized with empty value:
```typescript
const dataRef = useRef<Data[]>([]);
dataRef.current = newData;  // Updates JS side

useAnimatedReaction(
  () => someValue.value,
  (val) => {
    const item = dataRef.current[val];  // STALE - sees serialized empty array!
    runOnJS(doSomething)(item);
  }
);
```

**Correct** - use module-level variable:
```typescript
// Module level - resolved at runtime, not serialized
let moduleData: Data[] = [];

// In component:
moduleData = newData;  // Updates module variable

// JS function that reads module variable at call time
const handleChange = useCallback((val: number) => {
  const item = moduleData[val];  // CURRENT - reads at call time
  doSomething(item);
}, []);

useAnimatedReaction(
  () => someValue.value,
  (val) => {
    runOnJS(handleChange)(val);  // Pass primitive, read data in JS
  }
);
```

**Key principle**: Only pass primitives (numbers, strings) through `runOnJS()`. Read complex data (arrays, objects) from module-level variables inside the JS callback.

See `app/(tabs)/index.tsx` - `moduleEmails` for the pattern.

## React Native Gesture Handler Gotchas

### Gesture.Manual() Limitations
- **DO NOT use `onTouchesUp` or `onTouchesCancelled`** - these cause native crashes on iOS
- Only use `onTouchesDown` and `onTouchesMove` with Gesture.Manual()
- For detecting touch end, use a different approach (e.g., separate Gesture.Pan() or native touch responder)

## Environment Variables

Required in Convex dashboard:
- `WORKOS_CLIENT_ID`, `WORKOS_API_KEY` - WorkOS authentication
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Gmail OAuth
- `ANTHROPIC_API_KEY` - Claude AI for summarization
- `DEEPGRAM_API_KEY` - Voice transcription
- `OPENAI_API_KEY` - Optional, for embeddings

Required in `.env.local`:
- `EXPO_PUBLIC_CONVEX_URL` - Convex deployment URL
