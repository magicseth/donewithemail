# sayless - Development Notes

## Project Overview
AI-powered email triage app with TikTok-style swiping interface.

## Tech Stack
- **Frontend**: React Native (Expo) with expo-router
- **Backend**: Convex (real-time serverless)
- **Auth**: WorkOS (handles OAuth, provides Google tokens)
- **Email**: Gmail API via WorkOS OAuth tokens

## Architecture Decisions

### Authentication Flow
WorkOS handles OAuth including Gmail scopes. The flow:
1. User clicks "Sign in with Google" → redirects to WorkOS
2. WorkOS shows Google OAuth screen with Gmail permissions
3. After auth, WorkOS redirects to `/callback` with authorization code
4. `convex/auth.ts:authenticate` exchanges code with WorkOS API
5. WorkOS returns user info AND Google OAuth tokens (if "Return Google OAuth tokens" enabled)
6. Tokens stored in Convex `users` table (`gmailAccessToken`, `gmailRefreshToken`)

**Key insight**: OAuth tokens are only in the initial authenticate response, not when fetching user later.

### Email Sync
- `convex/gmailSync.ts:fetchEmails` fetches from Gmail API using stored tokens
- Emails are stored in Convex with `externalId` (Gmail message ID)
- Contacts are created/updated when emails are synced

### ID Handling
Gmail IDs (e.g., "19bcec856e234249") vs Convex IDs - need to handle both:
- Use `by_external_id` index to look up emails by Gmail ID
- Use `by_email` index to look up contacts by email address
- Helper functions detect ID type: `isEmail()`, `isValidConvexId()`

### Swipe Gestures on Web
react-native-gesture-handler needs configuration for web:
- `mouseButton(MouseButton.LEFT)` - enables left-click dragging
- `enableTrackpadTwoFingerGesture(true)` - trackpad support
- Use both distance threshold AND velocity for swipe detection
- Add `cursor: "grab"` and `userSelect: "none"` for web UX

## Common Patterns

### Convex Queries with Optional IDs
```typescript
const result = useQuery(
  api.something.getById,
  id ? { id } : "skip"  // "skip" prevents query when id is undefined
);
```

### Handling Both Convex ID and External ID
```typescript
const isConvex = id ? isConvexId(id) : false;
const byConvexId = useQuery(api.x.getById, isConvex ? { id } : "skip");
const byExternalId = useQuery(api.x.getByExternal, !isConvex ? { externalId: id } : "skip");
const result = isConvex ? byConvexId : byExternalId;
```

### Optimistic UI Updates
```typescript
// Immediately update UI
setTriagedIds(prev => new Set(prev).add(email._id));

try {
  await mutation();
} catch {
  // Revert on error
  setTriagedIds(prev => {
    const next = new Set(prev);
    next.delete(email._id);
    return next;
  });
}
```

## Schema Indexes
Important indexes for queries:
- `emails.by_external_id` - lookup by Gmail message ID
- `emails.by_from` - get emails from a contact
- `contacts.by_email` - lookup contact by email address
- `contacts.by_user_email` - lookup contact by user + email

## Development Commands
```bash
# Start Expo dev server
npx expo start --web

# Start Convex dev (deploys on save)
npx convex dev

# TypeScript watch (continuous type checking)
npx tsc --watch --noEmit

# Deploy Convex once
npx convex dev --once
```

## Debugging Tips
- Convex logs: Check Convex dashboard for server-side errors
- Browser console: Check for client-side errors
- Add `runOnJS(console.log)(data)` in gesture handlers (they run on UI thread)

## Known Issues / TODOs
- [ ] Token refresh: Need to handle expired Gmail tokens
- [ ] Full email body: Currently only storing snippet, not full body
- [ ] AI processing: Queue exists but processing not implemented yet
