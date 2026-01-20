# DoneWith

An AI-powered email triage app with a TikTok-style swiping interface. Quickly process your inbox by dragging emails to targets: Done, Reply Later, or Calendar.

## Features

- **AI-Powered Triage**: Emails are automatically analyzed and categorized by urgency
- **Swipe Interface**: Drag the triage ball to targets to quickly process emails
- **Batch AI Mode**: Review AI recommendations for entire inbox at once
- **Smart Notifications**: Only get notified for truly urgent emails
- **Calendar Integration**: Automatically extract and add events from emails
- **Quick Replies**: AI-generated reply suggestions for common responses

## Tech Stack

- **Frontend**: React Native (Expo 54) with expo-router
- **Backend**: Convex (real-time serverless)
- **Auth**: WorkOS (Google OAuth with Gmail access)
- **AI**: Claude Sonnet via Anthropic API

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Convex account

### Environment Variables

Create a `.env.local` file:

```
EXPO_PUBLIC_CONVEX_URL=your-convex-deployment-url
```

Set these in your Convex dashboard:
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`

### Development

```bash
# Install dependencies
npm install

# Start Convex backend (auto-deploys on save)
npx convex dev

# Start Expo dev server
npx expo start

# Type checking
npx tsc --watch --noEmit
```

### Building

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## Project Structure

```
app/                    # Expo Router screens
  (tabs)/              # Tab navigation
    index.tsx          # TODOs list
    inbox.tsx          # Inbox with triage UI
    settings.tsx       # Settings & account
  email/[id].tsx       # Email detail view
components/            # Reusable components
  batch/               # Batch triage UI
  triage/              # Swipe triage components
convex/                # Convex backend
  schema.ts            # Database schema
  emails.ts            # Email queries/mutations
  emailWorkflow.ts     # Email processing workflow
  summarizeActions.ts  # AI summarization
hooks/                 # React hooks
lib/                   # Utilities
plugins/               # Expo config plugins
```

## License

Private - All rights reserved
