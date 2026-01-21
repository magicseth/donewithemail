# Become: The Self-Realizing App

## Vision

"Become" is an app that becomes whatever you tell it to be. You install a shell, speak your vision, and watch as the app transforms itself into your idea - with checkpoints, code review, UX iteration, and continuous deployment.

The magic: **one command to install, one word to start, infinite possibilities**.

---

## Getting Started (User Experience)

### Step 1: Install (30 seconds)

```bash
npx create-become-app
```

What this does:
1. Downloads the Become shell (Expo app template)
2. Installs dependencies
3. Opens browser to `localhost:8081`

```
✔ What should we call your app? … my-recipe-app
✔ Creating project...
✔ Installing dependencies...

  Your app is ready!

  cd my-recipe-app
  npm run become

  Or just open: http://localhost:8081
```

What ends up on disk (initially just the shell):

```
my-recipe-app/
├── app/
│   ├── _layout.tsx          # Become shell root
│   └── index.tsx            # Become shell UI
├── package.json
├── app.json
└── .become/                  # Become metadata (gitignored)
    └── session.json          # Local session info
```

After first build, the user's actual app code appears:

```
my-recipe-app/
├── app/
│   ├── _layout.tsx          # Now includes user's app
│   ├── (tabs)/
│   │   ├── index.tsx        # Recipe list (Claude built this)
│   │   ├── planner.tsx      # Meal planner (Claude built this)
│   │   └── shopping.tsx     # Shopping list (Claude built this)
│   └── recipe/[id].tsx      # Recipe detail (Claude built this)
├── components/
│   └── RecipeCard.tsx       # Claude built this
├── convex/
│   ├── schema.ts            # recipes, mealPlans, etc.
│   └── recipes.ts           # CRUD functions
├── package.json
├── app.json
└── .become/
    ├── session.json
    └── project.json          # Links to GitHub/Convex/EAS
```

### Step 2: Sign In (15 seconds)

Browser opens to Become shell. User sees:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              Welcome to Become                  │
│                                                 │
│     The app that builds itself.                 │
│                                                 │
│     ┌─────────────────────────────────────┐    │
│     │   Continue with Google    →         │    │
│     └─────────────────────────────────────┘    │
│                                                 │
│     ┌─────────────────────────────────────┐    │
│     │   Try without signing in  →         │    │
│     └─────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**"Try without signing in"** gives a limited demo (5 requests, no save) - reduces friction for first experience.

### Step 3: Describe Your App (60 seconds)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     What do you want to make?                   │
│                                                 │
│     ┌───────────────────────────────────────┐  │
│     │                                       │  │
│     │     [ 🎤 Hold to speak ]              │  │
│     │                                       │  │
│     │     or type below                     │  │
│     └───────────────────────────────────────┘  │
│                                                 │
│     ┌───────────────────────────────────────┐  │
│     │ Describe your app idea...             │  │
│     └───────────────────────────────────────┘  │
│                                                 │
│     Examples:                                   │
│     • "A recipe app where I save recipes"      │
│     • "A workout tracker with timers"          │
│     • "A todo list for my family"              │
│                                                 │
└─────────────────────────────────────────────────┘
```

User speaks: *"I want a recipe app where I can save recipes and plan weekly meals"*

### Step 4: Agent Clarifies (30 seconds)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  🎙️ "A recipe app with meal planning"          │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  🤖 Great idea! Let me make sure I understand: │
│                                                 │
│     • Save your own recipes with ingredients   │
│     • Plan meals for the week                  │
│     • Generate a shopping list?                │
│                                                 │
│     Should I start with these features?        │
│                                                 │
│     ┌──────────────┐  ┌──────────────────────┐ │
│     │  Yes, build  │  │  Let me add more...  │ │
│     └──────────────┘  └──────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

User taps **"Yes, build"** or says *"yes"*

### Step 5: Building (2-3 minutes)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Building your Recipe App...                    │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ✓ Setting up your database                │ │
│  │ ✓ Creating recipe storage                 │ │
│  │ ● Building recipe list screen...          │ │
│  │ ○ Building meal planner                   │ │
│  │ ○ Building shopping list                  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  💭 "Adding a form to create new recipes       │
│      with title, ingredients, and steps..."    │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  45%     │
│                                                 │
└─────────────────────────────────────────────────┘
```

Progress streams in real-time from the worker.

### Step 6: Your App is Ready!

```
┌─────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │              🍳 My Recipes                  │ │
│ │  ─────────────────────────────────────────  │ │
│ │                                             │ │
│ │   ┌─────────────────────────────────────┐  │ │
│ │   │  🥗 Caesar Salad                    │  │ │
│ │   │  15 min · 4 ingredients             │  │ │
│ │   └─────────────────────────────────────┘  │ │
│ │                                             │ │
│ │   ┌─────────────────────────────────────┐  │ │
│ │   │  🍝 Pasta Carbonara                 │  │ │
│ │   │  25 min · 5 ingredients             │  │ │
│ │   └─────────────────────────────────────┘  │ │
│ │                                             │ │
│ │   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │ │
│ │   📋 Recipes    📅 Planner    🛒 List     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│  ✅ Your app is ready!                          │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  "The recipes need photos"              │   │
│  │                        [ 🎤 Hold ]      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

User can now:
- **Use the app** directly in the preview
- **Keep talking** to add features
- **Install on phone** via QR code (Expo Go)

### Step 7: Iterate Forever

```
User: "Add a photo to each recipe"

Agent: "I'll add photo upload to recipes. Should photos be
        required or optional?"

User: "Optional"

Agent: "Got it - adding optional photo field. Building now..."

[Build runs, app updates in ~60 seconds]

Agent: "Done! Recipes now have an optional photo. Try adding
        one to your Caesar Salad."
```

---

## Trial Mode (No Sign-In)

For zero-friction first experience:

```typescript
// Trial mode uses a shared "playground" infrastructure
// - Pre-provisioned Convex project (rotated daily)
// - Pre-provisioned GitHub repo (reset hourly)
// - 5 request limit per session
// - No persistence (app disappears after browser close)
// - Upgrade prompt after 3rd request

const TRIAL_LIMITS = {
  maxRequests: 5,
  sessionTimeout: 60 * 60 * 1000, // 1 hour
  showUpgradePrompt: 3, // After 3rd request
};
```

When user signs in, their trial app can be "claimed" - we provision real infrastructure and migrate their project.

---

## Quick Reference

| Action | How |
|--------|-----|
| **Install** | `npx create-become-app` |
| **Start** | `npm run become` |
| **Add feature** | Speak or type what you want |
| **Undo change** | "Go back to before the photos" |
| **See history** | Tap History button |
| **Install on phone** | Scan QR code with Expo Go |
| **Publish to App Store** | "Help me publish this" |

---

## Core Innovation

The breakthrough is treating app development as a **continuous conversation** between user and AI, with the app as the living artifact. Unlike traditional development:

- No IDE required
- No git knowledge required
- No deployment knowledge required
- The app is always runnable, always improving
- Every change is a checkpoint you can roll back to

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S DEVICE                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Become Shell (Expo)                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │   │
│  │  │ Voice Input  │  │ App Preview  │  │ Build Progress / Logs     │ │   │
│  │  │ (Deepgram)   │  │ (WebView)    │  │ (Real-time from Convex)   │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ WebSocket (Convex real-time)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BECOME PLATFORM (Central)                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Central Convex Database                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌────────────┐ │ │
│  │  │  users   │ │ projects │ │ requests │ │ workerRuns  │ │ checkpoints│ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────┘ └────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Planner Agent (@convex-dev/agent)                    │ │
│  │  - Clarifies vague requests through dialogue                           │ │
│  │  - Proposes implementation, waits for confirmation                     │ │
│  │  - Scopes large requests into phases                                   │ │
│  │  - Batches rapid requests into coherent specs                          │ │
│  │  - Only queues clear specs to workpool                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Convex Workpool (Job Queue)                          │ │
│  │  - @convex-dev/workpool manages request queue                          │ │
│  │  - Automatic retries with exponential backoff                          │ │
│  │  - Concurrency limits per user/project                                 │ │
│  │  - Dead letter queue for failed requests                               │ │
│  │  - Webhook triggers to external workers                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Worker Pool (Modal/Fly)                            │ │
│  │  - Stateless workers triggered by workpool webhook                     │ │
│  │  - Auto-scales based on queue depth                                    │ │
│  │  - Each worker handles one request at a time                           │ │
│  │  - Reports progress back to Convex via mutations                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Provisioning Service                                 │ │
│  │  - Creates GitHub repos from template                                   │ │
│  │  - Provisions Convex projects via API                                  │ │
│  │  - Sets up EAS project                                                  │ │
│  │  - Generates and stores access tokens                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Workpool triggers HTTP call
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL WORKER (Modal - Ephemeral)                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     Claude Code Worker                                  │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  1. Receive request details from workpool trigger                │  │ │
│  │  │  2. Clone/pull project repo                                      │  │ │
│  │  │  3. Run Claude Code with request as prompt                       │  │ │
│  │  │  4. POST progress to Convex HTTP endpoint                        │  │ │
│  │  │  5. Commit changes, push to repo                                 │  │ │
│  │  │  6. Deploy: convex deploy                                        │  │ │
│  │  │  7. Build: eas update --auto                                     │  │ │
│  │  │  8. Return result to workpool action                             │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  Environment:                                                           │ │
│  │  - ANTHROPIC_API_KEY (for Claude Code)                                 │ │
│  │  - GITHUB_TOKEN (for repo access)                                      │ │
│  │  - CONVEX_DEPLOY_KEY (for project deployment)                          │ │
│  │  - EXPO_TOKEN (for EAS updates)                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Deploys to
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PER-PROJECT INFRASTRUCTURE                              │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   GitHub Repo       │  │   Convex Project    │  │   EAS Project       │  │
│  │   (from template)   │  │   (user's data)     │  │   (OTA updates)     │  │
│  │                     │  │                     │  │                     │  │
│  │   - main branch     │  │   - schema.ts       │  │   - update channel  │  │
│  │   - feature branches│  │   - functions       │  │   - build artifacts │  │
│  │   - checkpoints/    │  │   - user tables     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Central Convex Schema

```typescript
// convex/schema.ts (Central Platform)

export default defineSchema({
  // User accounts
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),

  // Each user can have multiple projects (apps they're building)
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),                           // "my-recipe-app"
    description: v.string(),                    // Initial vision transcript
    status: v.union(
      v.literal("provisioning"),                // Setting up infra
      v.literal("active"),                      // Ready for requests
      v.literal("building"),                    // Claude is working
      v.literal("paused"),                      // User paused
      v.literal("archived")                     // Soft deleted
    ),

    // Infrastructure references
    githubRepo: v.string(),                     // "become-apps/user123-my-recipe-app"
    githubToken: v.string(),                    // Encrypted, scoped to repo
    convexProjectId: v.string(),                // Convex project slug
    convexDeployKey: v.string(),                // Encrypted deploy key
    easProjectId: v.string(),                   // EAS project ID
    updateChannel: v.string(),                  // EAS update channel

    // Current state
    currentCheckpointId: v.optional(v.id("checkpoints")),
    lastActivityAt: v.number(),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Feature requests from voice
  requests: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),

    // Input
    transcript: v.string(),                     // Voice transcript
    intent: v.optional(v.string()),             // AI-classified intent

    // Processing state
    status: v.union(
      v.literal("queued"),                      // Waiting for VM
      v.literal("planning"),                    // Claude is planning
      v.literal("implementing"),                // Claude is coding
      v.literal("testing"),                     // Running tests
      v.literal("reviewing"),                   // Self code review
      v.literal("deploying_backend"),           // convex dev --once
      v.literal("deploying_frontend"),          // eas update
      v.literal("completed"),                   // Done
      v.literal("failed"),                      // Error
      v.literal("rejected")                     // Claude determined not feasible
    ),

    // Progress tracking (streamed from Claude Code)
    progressPercent: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    progressLog: v.optional(v.array(v.object({
      timestamp: v.number(),
      message: v.string(),
      type: v.union(v.literal("info"), v.literal("success"), v.literal("error"), v.literal("thinking")),
    }))),

    // Output
    planSummary: v.optional(v.string()),        // What Claude plans to do
    filesChanged: v.optional(v.array(v.string())),
    commitHash: v.optional(v.string()),
    checkpointId: v.optional(v.id("checkpoints")),
    easUpdateId: v.optional(v.string()),

    // Errors
    error: v.optional(v.string()),
    errorDetails: v.optional(v.string()),

    // Timing
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("queued", ["status"]),  // For worker polling

  // Checkpoints (rollback points)
  checkpoints: defineTable({
    projectId: v.id("projects"),
    requestId: v.optional(v.id("requests")),    // Request that created this

    // Git state
    commitHash: v.string(),
    branchName: v.string(),
    commitMessage: v.string(),

    // Snapshot metadata
    description: v.string(),                    // AI-generated summary
    screenshotUrl: v.optional(v.string()),      // Visual snapshot

    // Schema snapshot (for rollback)
    schemaSnapshot: v.optional(v.string()),     // JSON of schema at this point

    // Parent for tree navigation
    parentId: v.optional(v.id("checkpoints")),

    createdAt: v.number(),
  })
    .index("by_project", ["projectId", "createdAt"]),

  // Worker execution history (tracked by workpool, extended here)
  workerRuns: defineTable({
    requestId: v.id("requests"),
    workpoolJobId: v.string(),                  // Workpool's job ID
    provider: v.union(v.literal("modal"), v.literal("fly")),
    externalJobId: v.optional(v.string()),      // Modal/Fly job ID

    // Execution details
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),

    // Cost tracking
    computeMs: v.optional(v.number()),          // Billable compute time
    estimatedCost: v.optional(v.number()),      // USD

    // Output
    success: v.boolean(),
    error: v.optional(v.string()),
    logs: v.optional(v.string()),               // Full execution log
  })
    .index("by_request", ["requestId"])
    .index("by_workpool_job", ["workpoolJobId"]),

  // Agent threads (@convex-dev/agent manages messages internally)
  agentThreads: defineTable({
    projectId: v.id("projects"),
    threadId: v.string(),                       // Agent component's thread ID

    // Extracted project understanding (updated after each build)
    projectSummary: v.optional(v.string()),
    knownScreens: v.optional(v.array(v.string())),
    knownFeatures: v.optional(v.array(v.string())),
    userPreferences: v.optional(v.object({
      communicationStyle: v.optional(v.string()),
      technicalLevel: v.optional(v.string()),
      designPreferences: v.optional(v.string()),
    })),

    createdAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_project", ["projectId"]),
});
```

### Central Convex Config

```typescript
// convex/convex.config.ts (Central Platform)

import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import pushNotifications from "@convex-dev/expo-push-notifications/convex.config";

const app = defineApp();
app.use(agent);            // AI agent for user dialogue (planning layer)
app.use(workpool);         // Job queue for build workers
app.use(workflow);         // Multi-step provisioning flows
app.use(pushNotifications); // Push notifications to user apps

export default app;
```

### Per-Project Convex Schema (Template)

```typescript
// template/convex/schema.ts (Starting point for user projects)

export default defineSchema({
  // Become system table - tracks app metadata
  _become: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // User's actual app data goes here
  // Claude will add tables as needed based on the app being built
});
```

---

## User Journey

### Phase 1: Installation & Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Install                                                 │
│                                                                  │
│  $ npx create-become-app my-idea                                │
│                                                                  │
│  ✓ Created project directory                                    │
│  ✓ Installed dependencies                                       │
│  ✓ Run 'cd my-idea && npm run become' to start                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Launch                                                  │
│                                                                  │
│  $ npm run become                                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │     ╔══════════════════════════════════════════════╗    │   │
│  │     ║                                              ║    │   │
│  │     ║            Welcome to Become                 ║    │   │
│  │     ║                                              ║    │   │
│  │     ║   What do you want to make?                  ║    │   │
│  │     ║                                              ║    │   │
│  │     ║         [ 🎤 Hold to speak ]                 ║    │   │
│  │     ║                                              ║    │   │
│  │     ╚══════════════════════════════════════════════╝    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User speaks: "I want to make a
                              │ recipe app where I can save recipes
                              │ and plan my weekly meals"
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Provisioning (30-60 seconds)                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │   Creating your app...                                   │   │
│  │                                                          │   │
│  │   ✓ Setting up your database                            │   │
│  │   ✓ Creating your code repository                       │   │
│  │   ● Designing initial architecture...                   │   │
│  │   ○ Building first version                              │   │
│  │                                                          │   │
│  │   "I'm creating a recipe app with meal planning.        │   │
│  │    This will include a recipe library, weekly           │   │
│  │    planner, and shopping list generator."               │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Active Development

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN INTERFACE (After initial build)                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │                    YOUR APP                         │ │   │
│  │ │  ┌───────────────────────────────────────────────┐  │ │   │
│  │ │  │                                               │  │ │   │
│  │ │  │     [Live preview of the app being built]    │  │ │   │
│  │ │  │                                               │  │ │   │
│  │ │  │     (WebView pointing to Expo web build      │  │ │   │
│  │ │  │      or native view when on device)          │  │ │   │
│  │ │  │                                               │  │ │   │
│  │ │  └───────────────────────────────────────────────┘  │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │  💬 "Add a button to share recipes via text"       │ │   │
│  │ │  ─────────────────────────────────────────────────  │ │   │
│  │ │  🤖 Planning... Adding share functionality with     │ │   │
│  │ │     expo-sharing and SMS deep links                 │ │   │
│  │ │  ─────────────────────────────────────────────────  │ │   │
│  │ │  ✓ Added share button to recipe detail screen       │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │         [ 🎤 Hold to speak ]      [ ⏪ History ]        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Voice Commands (Examples)

| User Says | System Does |
|-----------|-------------|
| "Make the header blue" | Updates theme/styles |
| "Add a settings page" | Creates new route + screen |
| "Let users sign in with Google" | Adds auth flow |
| "Save recipes to the cloud" | Adds Convex schema + sync |
| "Go back to how it was yesterday" | Rolls back to checkpoint |
| "What can this app do?" | Explains current features |
| "Show me the code for the recipe list" | Displays code in viewer |
| "This button is ugly, make it better" | AI redesigns UI element |
| "Add push notifications for meal reminders" | Full notification system |

---

## Conversational Agent Layer

Before any work hits the workpool, a Convex AI Agent handles dialogue with the user. This prevents wasted builds and ensures Claude Code gets clear, actionable requests.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AGENT DIALOGUE FLOW                                   │
│                                                                              │
│  User: "Make it look better"                                                 │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Convex Agent (@convex-dev/agent)                                       │ │
│  │                                                                         │ │
│  │  Agent: "I can help with that! Are you thinking about:                 │ │
│  │          • Colors and theme?                                            │ │
│  │          • Layout and spacing?                                          │ │
│  │          • A specific screen that needs work?"                         │ │
│  │                                                                         │ │
│  │  User: "The recipe list feels cramped"                                 │ │
│  │                                                                         │ │
│  │  Agent: "Got it. I'll add more padding, increase font size slightly,  │ │
│  │          and add subtle separators between recipes.                     │ │
│  │          Should I proceed?"                                             │ │
│  │                                                                         │ │
│  │  User: "Yes"                                                           │ │
│  │         │                                                               │ │
│  │         ▼                                                               │ │
│  │  ✅ Clear spec → Queue to workpool                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why @convex-dev/agent

The `@convex-dev/agent` component provides:

| Feature | How Become Uses It |
|---------|-------------------|
| **Persistent threads** | Each project has a conversation thread that persists context |
| **Tool calling** | Agent can query project state, queue builds, rollback |
| **Streaming responses** | Real-time typing indicator and response streaming |
| **Message history** | Full conversation available for context-aware responses |
| **Multi-turn dialogue** | Natural back-and-forth before committing to expensive builds |
| **Structured outputs** | Agent produces clear specs that Claude Code can execute |

### Agent Responsibilities

| Responsibility | Example |
|----------------|---------|
| **Clarify vague requests** | "Add auth" → "Google sign-in, email/password, or both?" |
| **Scope large requests** | "Build a social network" → "Let's start with profiles. What info should a profile show?" |
| **Confirm destructive changes** | "Delete the settings page" → "This will remove user preferences. Are you sure?" |
| **Propose implementation** | "I'll add a share button using expo-sharing. It'll appear in the top-right corner." |
| **Batch related requests** | User says 3 things quickly → Agent combines into one coherent spec |
| **Explain limitations** | "Camera access requires a native build. Want me to set that up?" |
| **Suggest alternatives** | "Push notifications need app store approval. Want local notifications instead for now?" |

### Agent Implementation

```typescript
// convex/agents/planner.ts

import { Agent } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";

export const plannerAgent = new Agent(components.agent, {
  name: "Become Planner",

  instructions: `You are the planning agent for Become, a self-building app platform.

Your job is to have a dialogue with the user to understand what they want to build,
then create a clear, actionable specification for the build worker.

## Your Responsibilities

1. CLARIFY vague requests before building
   - "Make it better" → Ask what specifically needs improvement
   - "Add a feature" → Ask what the feature should do

2. SCOPE large requests into phases
   - Don't try to build everything at once
   - Suggest starting with core functionality
   - Offer to add more in follow-up requests

3. CONFIRM before queuing expensive builds
   - Summarize what you'll build
   - Wait for user approval
   - Only then call queueBuildRequest

4. EXPLAIN technical constraints
   - Native modules need app store builds
   - Some features have dependencies
   - Be honest about limitations

5. REMEMBER conversation context
   - Reference previous changes
   - Build on existing features
   - Maintain project coherence

## Tools Available

- queueBuildRequest: Send a clear spec to the build worker
- getProjectState: Check current screens, schema, features
- getRecentChanges: See what was recently built
- rollbackToCheckpoint: Undo recent changes

## Response Style

- Conversational, not robotic
- Brief but clear
- Always end with a question OR a confirmation to build
- Use the user's language (if they say "thingy", you say "thingy")
`,

  tools: {
    queueBuildRequest: {
      description: "Queue a build request to the worker. Only call this when you have a clear, confirmed spec.",
      args: {
        projectId: v.id("projects"),
        specification: v.string(),  // Clear, detailed spec for Claude Code
        estimatedComplexity: v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
      },
      handler: async (ctx, args) => {
        // Create request with the refined specification
        const requestId = await ctx.runMutation(internal.requests.create, {
          projectId: args.projectId,
          transcript: args.specification,
          source: "agent",  // Indicates this came through the agent
          complexity: args.estimatedComplexity,
        });

        // Enqueue to workpool
        await ctx.runMutation(internal.workpool.enqueueRequest, { requestId });

        return {
          success: true,
          requestId,
          message: `Build queued! I'll let you know when it's ready.`,
        };
      },
    },

    getProjectState: {
      description: "Get the current state of the project - screens, features, schema",
      args: {
        projectId: v.id("projects"),
      },
      handler: async (ctx, { projectId }) => {
        const project = await ctx.runQuery(internal.projects.getState, { projectId });
        return {
          screens: project.screens,
          schema: project.schemaDescription,
          recentFeatures: project.recentFeatures,
        };
      },
    },

    getRecentChanges: {
      description: "Get recent checkpoints and what changed",
      args: {
        projectId: v.id("projects"),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, { projectId, limit }) => {
        const checkpoints = await ctx.runQuery(internal.checkpoints.recent, {
          projectId,
          limit: limit ?? 5,
        });
        return checkpoints.map(c => ({
          description: c.description,
          createdAt: c.createdAt,
          canRollback: true,
        }));
      },
    },

    rollbackToCheckpoint: {
      description: "Rollback to a previous checkpoint. Confirm with user first!",
      args: {
        projectId: v.id("projects"),
        checkpointId: v.id("checkpoints"),
      },
      handler: async (ctx, args) => {
        await ctx.runMutation(internal.checkpoints.rollback, args);
        return { success: true, message: "Rolled back successfully. The app will update shortly." };
      },
    },
  },

  // Model configuration
  model: "claude-sonnet-4-20250514",
  maxTokens: 1024,
});
```

### Agent-Enhanced Request Flow

```typescript
// convex/chat.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { plannerAgent } from "./agents/planner";

// User sends a message (voice transcript or text)
export const sendMessage = mutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
  },
  handler: async (ctx, { projectId, content }) => {
    const user = await ctx.auth.getUserIdentity();

    // Get or create thread for this project
    let thread = await ctx.db
      .query("agentThreads")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .unique();

    if (!thread) {
      const threadId = await plannerAgent.createThread(ctx, {
        metadata: { projectId, userId: user.subject },
      });
      await ctx.db.insert("agentThreads", { projectId, threadId });
      thread = { threadId };
    }

    // Add user message and get agent response
    const response = await plannerAgent.chat(ctx, {
      threadId: thread.threadId,
      content,
    });

    return {
      userMessage: content,
      agentResponse: response.content,
      // If agent called queueBuildRequest, include the request ID
      buildQueued: response.toolCalls?.find(t => t.name === "queueBuildRequest")?.result,
    };
  },
});

// Stream agent responses for real-time UI
export const streamResponse = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const thread = await ctx.db
      .query("agentThreads")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .unique();

    if (!thread) return null;

    return await plannerAgent.getMessages(ctx, { threadId: thread.threadId });
  },
});
```

### UI Integration

```typescript
// app/components/ChatInterface.tsx

import { useState, useCallback } from "react";
import { View, Text, TextInput, FlatList, Pressable } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function ChatInterface({ projectId }: { projectId: Id<"projects"> }) {
  const [input, setInput] = useState("");
  const messages = useQuery(api.chat.streamResponse, { projectId });
  const sendMessage = useMutation(api.chat.sendMessage);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const message = input;
    setInput("");

    await sendMessage({ projectId, content: message });
  }, [input, projectId, sendMessage]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View style={{
            padding: 12,
            backgroundColor: item.role === "user" ? "#e3f2fd" : "#f5f5f5",
            marginVertical: 4,
            borderRadius: 12,
            alignSelf: item.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "80%",
          }}>
            <Text>{item.content}</Text>

            {/* Show build status if this message triggered a build */}
            {item.buildQueued && (
              <BuildProgress requestId={item.buildQueued.requestId} />
            )}
          </View>
        )}
        keyExtractor={item => item.id}
      />

      <View style={{ flexDirection: "row", padding: 12 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Describe what you want to build..."
          style={{ flex: 1, borderWidth: 1, borderRadius: 20, padding: 12 }}
          onSubmitEditing={handleSend}
        />
        <Pressable onPress={handleSend} style={{ padding: 12 }}>
          <Text>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

### Agent vs Direct Queue

| Scenario | Path |
|----------|------|
| Vague request ("make it better") | Agent dialogue → clarify → queue |
| Clear request ("add a blue button to the header") | Agent confirms → queue immediately |
| Complex request ("add authentication") | Agent scopes → multiple builds |
| Correction ("no, I meant the OTHER button") | Agent adjusts spec → re-queue |
| Rollback ("undo that") | Agent confirms → rollback |
| Question ("what screens do I have?") | Agent answers → no build |

### Conversation Memory

The agent maintains context across sessions via the `agentThreads` table (defined in central schema above). Key features:

- **Thread per project**: Each project has one agent thread that persists
- **Project understanding**: Agent updates its knowledge of screens/features after each build
- **User preferences**: Learns communication style, technical level, design preferences
- **@convex-dev/agent storage**: Message history managed by the agent component internally

---

## Request Lifecycle (Agent + Workpool)

```
┌──────────────┐     ┌──────────────────────────────────────────────────────────┐
│ User speaks  │────▶│ Planner Agent                                            │
│ "add button" │     │                                                          │
└──────────────┘     │  Agent: "I'll add a button. Where should it go -        │
                     │          header, footer, or floating bottom-right?"      │
                     │                                                          │
                     │  User: "floating bottom right, make it blue"            │
                     │                                                          │
                     │  Agent: "Got it - blue floating action button,          │
                     │          bottom-right corner. Building now..."          │
                     │                                                          │
                     │  ✅ Calls queueBuildRequest with clear spec             │
                     └──────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          WORKPOOL QUEUE                                       │
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          WORKPOOL QUEUE                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                            │
│  │ Job 1   │ │ Job 2   │ │ Job 3   │ │ Job 4   │  ...                       │
│  │ user-a  │ │ user-b  │ │ user-a  │ │ user-c  │                            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                            │
│                                                                              │
│  Concurrency: 10 parallel │ Retries: 3 │ Timeout: 30min                     │
└──────────────────────────────────────────────────────────────────────────────┘
                            │
                            │ Workpool triggers action
                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  processRequest action (runs in Convex)                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Fetch request + project details                                      │ │
│  │ 2. Call external worker (Modal/Fly)                                     │ │
│  │ 3. Worker streams progress via webhook → Convex mutations               │ │
│  │ 4. Worker returns success/failure                                       │ │
│  │ 5. Update request status, create checkpoint                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP call to Modal
                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Modal Worker (ephemeral container)                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Clone project repo                                                   │ │
│  │ 2. Run Claude Code with user's request                                  │ │
│  │ 3. POST progress to webhook (Convex HTTP action)                        │ │
│  │ 4. Commit + push changes                                                │ │
│  │ 5. Deploy Convex (convex deploy)                                        │ │
│  │ 6. Deploy frontend (eas update)                                         │ │
│  │ 7. Return result                                                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                            │
                            │ EAS Update pushed
                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  User's App                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ expo-updates detects new version → hot reload → user sees new feature   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Workpool Benefits

| Feature | How We Use It |
|---------|---------------|
| **Concurrency limits** | Prevent overload - max 10 parallel builds globally, 1 per user |
| **Automatic retries** | Transient failures (network, API limits) auto-retry with backoff |
| **Deduplication** | Rapid duplicate requests are combined (uniqueKey) |
| **Delayed execution** | Debounce quick successive requests (delayMs) |
| **Dead letter queue** | Failed jobs preserved for debugging |
| **Status tracking** | Built-in job status without custom polling logic |
| **Cancellation** | Cancel pending jobs when user rolls back |

---

## Technical Implementation

### 1. Become Shell (Expo App)

```typescript
// app/(tabs)/index.tsx - Main shell interface

import { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useVoiceRecording } from "../hooks/useVoiceRecording";

export default function BecomeShell() {
  const project = useQuery(api.projects.current);
  const requests = useQuery(api.requests.recent,
    project ? { projectId: project._id } : "skip"
  );
  const submitRequest = useMutation(api.requests.submit);

  const { isRecording, startRecording, stopRecording, transcript } =
    useVoiceRecording();

  const handleRecordingComplete = useCallback(async (transcript: string) => {
    if (!project) return;
    await submitRequest({
      projectId: project._id,
      transcript
    });
  }, [project, submitRequest]);

  // Show onboarding if no project
  if (!project) {
    return <OnboardingFlow />;
  }

  // Show provisioning if still setting up
  if (project.status === "provisioning") {
    return <ProvisioningProgress project={project} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Live app preview */}
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: project.previewUrl }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Request history / progress */}
      <RequestFeed requests={requests} />

      {/* Voice input */}
      <VoiceButton
        isRecording={isRecording}
        onPressIn={startRecording}
        onPressOut={async () => {
          const text = await stopRecording();
          if (text) handleRecordingComplete(text);
        }}
      />
    </View>
  );
}
```

### 2. Provisioning Service

```typescript
// convex/provisioning.ts

import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Step 1: Create GitHub repo from template
export const createRepo = internalAction({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, { projectId, name }) => {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Create repo from template
    const { data: repo } = await octokit.repos.createUsingTemplate({
      template_owner: "become-apps",
      template_repo: "become-template",
      owner: "become-apps",
      name: `user-${projectId}-${name}`,
      private: true,
    });

    // Create a scoped token for this repo only
    const { data: token } = await octokit.apps.createInstallationAccessToken({
      installation_id: process.env.GITHUB_APP_INSTALLATION_ID,
      repositories: [repo.name],
      permissions: { contents: "write", workflows: "write" },
    });

    return { repoUrl: repo.clone_url, token: token.token };
  },
});

// Step 2: Provision Convex project
export const createConvexProject = internalAction({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, { projectId, name }) => {
    // Use Convex CLI or API to create new project
    const response = await fetch("https://api.convex.dev/projects", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CONVEX_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `become-${projectId}-${name}`,
        teamId: process.env.CONVEX_TEAM_ID,
      }),
    });

    const project = await response.json();

    // Get deploy key
    const deployKeyResponse = await fetch(
      `https://api.convex.dev/projects/${project.id}/deploy-keys`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.CONVEX_ADMIN_TOKEN}`,
        },
      }
    );

    const { key } = await deployKeyResponse.json();

    return {
      convexProjectId: project.id,
      convexUrl: project.url,
      deployKey: key
    };
  },
});

// Step 3: Create EAS project
export const createEasProject = internalAction({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, { projectId, name }) => {
    // Use EAS CLI or API
    const response = await fetch("https://api.expo.dev/v2/projects", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.EXPO_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `become-${name}`,
        slug: `become-${projectId}`,
      }),
    });

    const project = await response.json();

    return {
      easProjectId: project.id,
      updateChannel: "production",
    };
  },
});

// Orchestrate full provisioning
export const provisionProject = internalAction({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    // Update status
    await ctx.runMutation(internal.projects.updateStatus, {
      projectId: args.projectId,
      status: "provisioning",
      message: "Creating your code repository...",
    });

    // Create GitHub repo
    const { repoUrl, token } = await ctx.runAction(
      internal.provisioning.createRepo,
      { projectId: args.projectId, name: args.name }
    );

    await ctx.runMutation(internal.projects.updateStatus, {
      projectId: args.projectId,
      message: "Setting up your database...",
    });

    // Create Convex project
    const { convexProjectId, convexUrl, deployKey } = await ctx.runAction(
      internal.provisioning.createConvexProject,
      { projectId: args.projectId, name: args.name }
    );

    await ctx.runMutation(internal.projects.updateStatus, {
      projectId: args.projectId,
      message: "Configuring deployment...",
    });

    // Create EAS project
    const { easProjectId, updateChannel } = await ctx.runAction(
      internal.provisioning.createEasProject,
      { projectId: args.projectId, name: args.name }
    );

    // Save all infrastructure details
    await ctx.runMutation(internal.projects.setInfrastructure, {
      projectId: args.projectId,
      githubRepo: repoUrl,
      githubToken: token,
      convexProjectId,
      convexDeployKey: deployKey,
      easProjectId,
      updateChannel,
    });

    // Queue initial build request
    await ctx.runMutation(internal.requests.createInitial, {
      projectId: args.projectId,
      description: args.description,
    });

    await ctx.runMutation(internal.projects.updateStatus, {
      projectId: args.projectId,
      status: "building",
      message: "Building your first version...",
    });
  },
});
```

### 3. Convex Workpool Integration

```typescript
// convex/workpool.ts - Workpool configuration

import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

// Create the workpool for processing requests
export const requestPool = new Workpool(components.workpool, {
  // Max concurrent jobs across all workers
  maxParallelism: 10,

  // Per-action timeout (30 minutes for complex builds)
  actionTimeoutMs: 30 * 60 * 1000,

  // Retry configuration
  retryOptions: {
    maxRetries: 3,
    initialBackoffMs: 5000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
  },

  // Log configuration for debugging
  logLevel: "INFO",
});

// Start a request processing job
export const enqueueRequest = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");

    // Enqueue to workpool - will trigger processRequest action
    await requestPool.enqueue(
      ctx,
      internal.worker.processRequest,
      { requestId },
      {
        // Unique key prevents duplicate processing
        uniqueKey: requestId,
        // Delay for debouncing rapid requests
        delayMs: 1000,
        // Custom retry for this specific job
        retryOptions: {
          maxRetries: 2,
        },
      }
    );

    await ctx.db.patch(requestId, { status: "queued" });
  },
});

// Get pool status for dashboard
export const getPoolStatus = query({
  args: {},
  handler: async (ctx) => {
    return await requestPool.status(ctx);
  },
});
```

```typescript
// convex/worker.ts - The action that processes requests

"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

// This action is triggered by workpool
// It calls out to external worker (Modal/Fly) and streams progress back
export const processRequest = internalAction({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const request = await ctx.runQuery(internal.requests.get, { requestId });
    if (!request) throw new Error("Request not found");

    const project = await ctx.runQuery(internal.projects.get, {
      projectId: request.projectId
    });

    // Update status
    await ctx.runMutation(internal.requests.updateStatus, {
      requestId,
      status: "processing",
      message: "Starting worker...",
    });

    // Call external worker (Modal function or Fly machine)
    const workerResult = await callExternalWorker({
      requestId,
      projectId: request.projectId,
      transcript: request.transcript,
      repo: project.githubRepo,
      repoToken: project.githubToken,
      convexUrl: project.convexUrl,
      convexDeployKey: project.convexDeployKey,
      easProjectId: project.easProjectId,
      // Callback URL for progress updates
      progressWebhook: `${process.env.CONVEX_SITE_URL}/worker-progress`,
    });

    if (!workerResult.success) {
      throw new Error(workerResult.error);
    }

    // Worker succeeded - update final state
    await ctx.runMutation(internal.requests.complete, {
      requestId,
      commitHash: workerResult.commitHash,
      easUpdateId: workerResult.easUpdateId,
    });

    // Create checkpoint
    await ctx.runMutation(internal.checkpoints.create, {
      projectId: request.projectId,
      requestId,
      commitHash: workerResult.commitHash,
      description: request.transcript.slice(0, 200),
    });
  },
});

// External worker call (Modal is ideal here)
async function callExternalWorker(params: WorkerParams): Promise<WorkerResult> {
  // Option 1: Modal (recommended - serverless GPU/CPU functions)
  if (process.env.MODAL_TOKEN) {
    const response = await fetch("https://your-modal-app.modal.run/process", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MODAL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  // Option 2: Fly Machines API
  if (process.env.FLY_API_TOKEN) {
    // Spin up ephemeral machine, wait for completion
    return await runFlyMachine(params);
  }

  throw new Error("No worker backend configured");
}
```

### 4. External Worker (Modal - Recommended)

Modal is ideal because it provides:
- Serverless containers with full filesystem access
- Auto-scaling from 0 to N workers
- Pay-per-second billing
- Built-in secrets management
- Native Python but supports any container

```python
# modal_worker.py - Modal function for running Claude Code

import modal
import subprocess
import os
import json
import requests
from pathlib import Path

app = modal.App("become-worker")

# Container image with Claude Code and tools
image = (
    modal.Image.debian_slim()
    .apt_install("git", "curl", "nodejs", "npm")
    .run_commands(
        "npm install -g @anthropic-ai/claude-code convex eas-cli",
    )
)

@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("anthropic"),
        modal.Secret.from_name("github"),
    ],
    timeout=1800,  # 30 minutes max
    cpu=2,
    memory=4096,
)
def process_request(
    request_id: str,
    project_id: str,
    transcript: str,
    repo: str,
    repo_token: str,
    convex_url: str,
    convex_deploy_key: str,
    eas_project_id: str,
    progress_webhook: str,
) -> dict:
    """Process a single Become request with Claude Code."""

    work_dir = Path(f"/tmp/become/{project_id}")
    work_dir.mkdir(parents=True, exist_ok=True)

    def report_progress(status: str, percent: int, message: str):
        requests.post(progress_webhook, json={
            "requestId": request_id,
            "status": status,
            "progressPercent": percent,
            "progressMessage": message,
        })

    try:
        # Clone or update repo
        report_progress("cloning", 5, "Fetching code...")
        clone_url = repo.replace("https://", f"https://x-access-token:{repo_token}@")

        if (work_dir / ".git").exists():
            subprocess.run(["git", "pull"], cwd=work_dir, check=True)
        else:
            subprocess.run(["git", "clone", clone_url, str(work_dir)], check=True)

        # Get conversation context
        report_progress("planning", 10, "Understanding your request...")

        # Build prompt
        prompt = build_prompt(transcript, work_dir)

        # Run Claude Code
        report_progress("implementing", 20, "Building your feature...")

        result = subprocess.run(
            [
                "claude",
                "--dangerously-skip-permissions",
                "--output-format", "json",
                "-p", prompt,
            ],
            cwd=work_dir,
            env={
                **os.environ,
                "ANTHROPIC_API_KEY": os.environ["ANTHROPIC_API_KEY"],
            },
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            raise Exception(f"Claude Code failed: {result.stderr}")

        # Commit changes
        report_progress("committing", 70, "Saving changes...")

        subprocess.run(["git", "add", "-A"], cwd=work_dir, check=True)
        subprocess.run(
            ["git", "commit", "-m", f"feat: {transcript[:50]}"],
            cwd=work_dir,
            check=True,
        )
        subprocess.run(["git", "push"], cwd=work_dir, check=True)

        commit_hash = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=work_dir,
            capture_output=True,
            text=True,
        ).stdout.strip()

        # Deploy Convex
        report_progress("deploying_backend", 80, "Updating database...")

        subprocess.run(
            ["npx", "convex", "deploy", "--cmd", "npm run build"],
            cwd=work_dir,
            env={
                **os.environ,
                "CONVEX_DEPLOY_KEY": convex_deploy_key,
            },
            check=True,
        )

        # Deploy EAS update
        report_progress("deploying_frontend", 90, "Publishing app update...")

        eas_result = subprocess.run(
            ["eas", "update", "--auto", "--json"],
            cwd=work_dir,
            capture_output=True,
            text=True,
        )

        eas_data = json.loads(eas_result.stdout)
        eas_update_id = eas_data.get("id", "")

        report_progress("completed", 100, "Done!")

        return {
            "success": True,
            "commitHash": commit_hash,
            "easUpdateId": eas_update_id,
        }

    except Exception as e:
        report_progress("failed", 0, str(e))
        return {
            "success": False,
            "error": str(e),
        }


def build_prompt(transcript: str, work_dir: Path) -> str:
    # Read CLAUDE.md for project context
    claude_md = (work_dir / "CLAUDE.md").read_text()

    return f"""
{claude_md}

## User Request
{transcript}

## Instructions
1. Analyze the request and plan your approach
2. Make the requested changes
3. Ensure the app still builds
4. Keep changes minimal and focused
"""
```

### 5. HTTP Progress Webhook

```typescript
// convex/http.ts - HTTP routes for worker callbacks

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Workers POST progress updates here
http.route({
  path: "/worker-progress",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify request is from our worker (shared secret)
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.WORKER_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { requestId, status, progressPercent, progressMessage, log } = body;

    // Update request progress
    await ctx.runMutation(internal.requests.updateProgress, {
      requestId,
      status,
      progressPercent,
      progressMessage,
    });

    // Append to log if provided
    if (log) {
      await ctx.runMutation(internal.requests.appendLog, {
        requestId,
        message: log.message,
        type: log.type,
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

### 6. VM Worker (Alternative - Fly.io Machines)

async function processRequest(request: Request, vmId: string) {
  const { projectId, _id: requestId, transcript } = request;

  try {
    // Get project details
    const project = await convex.query(api.projects.get, { projectId });

    // Update status
    await updateProgress(requestId, "planning", 5, "Analyzing your request...");

    // Clone or pull repo
    const repoPath = path.join(WORK_DIR, projectId);
    await setupRepo(repoPath, project.githubRepo, project.githubToken);

    // Get conversation history for context
    const history = await convex.query(api.conversations.recent, { projectId });

    // Build Claude Code prompt
    const prompt = buildPrompt(transcript, history, project);

    // Run Claude Code
    await runClaudeCode(repoPath, prompt, requestId, project);

    // Commit and push
    await updateProgress(requestId, "deploying_backend", 80, "Deploying backend...");
    const commitHash = await commitAndPush(repoPath, transcript);

    // Deploy Convex
    await deployConvex(repoPath, project.convexDeployKey);

    // Deploy frontend
    await updateProgress(requestId, "deploying_frontend", 90, "Publishing update...");
    const easUpdateId = await deployEas(repoPath, project.easProjectId);

    // Create checkpoint
    const checkpointId = await convex.mutation(api.checkpoints.create, {
      projectId,
      requestId,
      commitHash,
      description: `Implemented: ${transcript.slice(0, 100)}`,
    });

    // Mark complete
    await convex.mutation(api.requests.complete, {
      requestId,
      commitHash,
      checkpointId,
      easUpdateId,
    });

  } catch (error) {
    await convex.mutation(api.requests.fail, {
      requestId,
      error: error.message,
      errorDetails: error.stack,
    });
  }
}

async function runClaudeCode(
  repoPath: string,
  prompt: string,
  requestId: string,
  project: Project
) {
  return new Promise((resolve, reject) => {
    const claude = spawn("claude", [
      "--dangerously-skip-permissions",
      "--output-format", "stream-json",
      "-p", prompt,
    ], {
      cwd: repoPath,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
    });

    let lastProgress = 10;

    claude.stdout.on("data", async (data) => {
      const lines = data.toString().split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          // Stream progress to Convex
          if (event.type === "assistant") {
            // Claude is thinking/working
            lastProgress = Math.min(lastProgress + 2, 75);
            await appendLog(requestId, event.content, "thinking");
          } else if (event.type === "tool_use") {
            // Claude is using a tool
            await appendLog(requestId, `Using ${event.tool}: ${event.description}`, "info");
          } else if (event.type === "result") {
            // A tool completed
            await appendLog(requestId, event.summary, "success");
          }

          await updateProgress(requestId, "implementing", lastProgress);

        } catch (e) {
          // Non-JSON output, just log it
          await appendLog(requestId, line, "info");
        }
      }
    });

    claude.stderr.on("data", async (data) => {
      await appendLog(requestId, data.toString(), "error");
    });

    claude.on("close", (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Claude Code exited with code ${code}`));
      }
    });
  });
}

function buildPrompt(transcript: string, history: Message[], project: Project): string {
  return `
You are building a ${project.description}.

## Previous conversation:
${history.map(m => `${m.role}: ${m.content}`).join("\n")}

## User's new request:
${transcript}

## Instructions:
1. Analyze the request and plan your approach
2. Implement the requested feature/change
3. Update the Convex schema if needed (convex/schema.ts)
4. Create or modify React Native components as needed
5. Ensure the app still builds and runs
6. Write a brief summary of what you changed

## Important:
- This is an Expo app with Convex backend
- Use expo-router for navigation
- Keep the code simple and readable
- Test your changes work before finishing
`;
}

async function updateProgress(
  requestId: string,
  status: string,
  percent: number,
  message?: string
) {
  await convex.mutation(api.requests.updateProgress, {
    requestId,
    status,
    progressPercent: percent,
    progressMessage: message,
  });
}

async function appendLog(requestId: string, message: string, type: string) {
  await convex.mutation(api.requests.appendLog, {
    requestId,
    message,
    type,
  });
}

main();
```

### 4. Checkpoint & Rollback System

```typescript
// convex/checkpoints.ts

export const rollback = mutation({
  args: {
    projectId: v.id("projects"),
    checkpointId: v.id("checkpoints"),
  },
  handler: async (ctx, { projectId, checkpointId }) => {
    const checkpoint = await ctx.db.get(checkpointId);
    if (!checkpoint || checkpoint.projectId !== projectId) {
      throw new Error("Checkpoint not found");
    }

    // Create a rollback request
    const requestId = await ctx.db.insert("requests", {
      projectId,
      userId: ctx.auth.userId,
      transcript: `[SYSTEM] Rollback to checkpoint: ${checkpoint.description}`,
      status: "queued",
      intent: "rollback",
      createdAt: Date.now(),
    });

    // Store rollback metadata
    await ctx.db.patch(requestId, {
      rollbackTarget: checkpointId,
    });

    return requestId;
  },
});

// Worker handles rollback specially
async function handleRollback(request: Request, checkpoint: Checkpoint) {
  // Git reset to checkpoint commit
  await exec(`git reset --hard ${checkpoint.commitHash}`, { cwd: repoPath });
  await exec(`git push --force origin main`, { cwd: repoPath });

  // Restore Convex schema
  if (checkpoint.schemaSnapshot) {
    await fs.writeFile(
      path.join(repoPath, "convex/schema.ts"),
      checkpoint.schemaSnapshot
    );
    await deployConvex(repoPath, project.convexDeployKey);
  }

  // Push EAS update
  await deployEas(repoPath, project.easProjectId);
}
```

### 5. Self-Review System

```typescript
// worker/review.ts

async function selfReview(repoPath: string, requestId: string): Promise<ReviewResult> {
  // Get the diff of what Claude changed
  const diff = await exec("git diff HEAD~1", { cwd: repoPath });

  const reviewPrompt = `
You are reviewing code changes for a mobile app.
Analyze the following diff and identify:

1. **Bugs**: Logic errors, null pointer issues, race conditions
2. **Security**: Input validation, data exposure, auth issues
3. **UX Issues**: Confusing flows, missing loading states, error handling
4. **Performance**: N+1 queries, unnecessary re-renders, memory leaks
5. **Style**: Inconsistent naming, missing types, unclear code

## Diff:
${diff}

Respond with JSON:
{
  "approved": boolean,
  "issues": [
    { "severity": "critical|warning|suggestion", "file": "path", "line": number, "issue": "description", "fix": "suggested fix" }
  ],
  "summary": "overall assessment"
}
`;

  const review = await runClaude(reviewPrompt);

  if (!review.approved) {
    // Apply fixes
    for (const issue of review.issues.filter(i => i.severity === "critical")) {
      await runClaudeCode(repoPath, `Fix this issue: ${issue.issue} in ${issue.file}`);
    }

    // Commit fixes
    await exec('git add -A && git commit -m "fix: address review issues"', { cwd: repoPath });

    // Re-review
    return selfReview(repoPath, requestId);
  }

  return review;
}
```

### 6. UX Design Agent

```typescript
// worker/ux-design.ts

async function designReview(repoPath: string, requestId: string): Promise<void> {
  // Take screenshots of all screens
  const screens = await findAllScreens(repoPath);
  const screenshots = [];

  for (const screen of screens) {
    const screenshot = await captureScreen(screen);
    screenshots.push({ screen, screenshot });
  }

  const designPrompt = `
You are a UX designer reviewing a mobile app.
Analyze these screenshots and the code to identify:

1. **Visual Hierarchy**: Is the most important content prominent?
2. **Consistency**: Do similar elements look similar?
3. **Accessibility**: Color contrast, touch targets, text size
4. **Mobile Patterns**: Does it follow iOS/Android conventions?
5. **Empty States**: What happens with no data?
6. **Error States**: How are errors communicated?

[Screenshots attached]

Respond with specific, actionable improvements.
`;

  const designFeedback = await runClaudeWithImages(designPrompt, screenshots);

  // Apply high-impact suggestions
  for (const suggestion of designFeedback.improvements.filter(i => i.impact === "high")) {
    await runClaudeCode(repoPath, `
      Apply this UX improvement: ${suggestion.description}
      File: ${suggestion.file}
      Current: ${suggestion.current}
      Suggested: ${suggestion.suggested}
    `);
  }
}
```

---

## Rate Limiting & Quotas

Leveraging workpool for quota enforcement:

```typescript
// convex/requests.ts

import { requestPool } from "./workpool";

export const submit = mutation({
  args: {
    projectId: v.id("projects"),
    transcript: v.string(),
  },
  handler: async (ctx, { projectId, transcript }) => {
    const user = await ctx.auth.getUserIdentity();
    const userDoc = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", user.email))
      .unique();

    // Check daily quota
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRequests = await ctx.db
      .query("requests")
      .withIndex("by_user_date", q =>
        q.eq("userId", userDoc._id).gte("createdAt", today.getTime())
      )
      .collect();

    const limits = PLAN_LIMITS[userDoc.plan];
    if (todayRequests.length >= limits.requestsPerDay) {
      throw new Error(
        `Daily limit reached (${limits.requestsPerDay} requests). ` +
        `Upgrade to Pro for more.`
      );
    }

    // Check concurrent requests (via workpool)
    const pendingJobs = await requestPool.status(ctx);
    const userPendingJobs = pendingJobs.pending.filter(
      j => j.args.userId === userDoc._id
    );

    if (userPendingJobs.length >= limits.concurrentRequests) {
      throw new Error(
        "You have requests in progress. Please wait for them to complete."
      );
    }

    // Create request
    const requestId = await ctx.db.insert("requests", {
      projectId,
      userId: userDoc._id,
      transcript,
      status: "pending",
      createdAt: Date.now(),
    });

    // Enqueue with priority based on plan
    await requestPool.enqueue(
      ctx,
      internal.worker.processRequest,
      { requestId, userId: userDoc._id },
      {
        uniqueKey: requestId,
        priority: PLAN_PRIORITY[userDoc.plan], // pro users get priority
      }
    );

    return requestId;
  },
});

const PLAN_LIMITS = {
  free: { requestsPerDay: 10, concurrentRequests: 1, checkpoints: 5 },
  pro: { requestsPerDay: 100, concurrentRequests: 3, checkpoints: 50 },
  team: { requestsPerDay: Infinity, concurrentRequests: 10, checkpoints: Infinity },
};

const PLAN_PRIORITY = {
  free: 0,
  pro: 5,
  team: 10,
};
```

---

## Security Model

### Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY BOUNDARIES                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  User A's Project                                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ GitHub  │ │ Convex  │ │  EAS    │ │   VM    │       │   │
│  │  │ Repo A  │ │ DB A    │ │ Proj A  │ │ (temp)  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │  ════════════════════════════════════════════════       │   │
│  │  Scoped GitHub token │ Scoped deploy key │ Scoped token │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                      ISOLATED                                    │
│                           │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  User B's Project                                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ GitHub  │ │ Convex  │ │  EAS    │ │   VM    │       │   │
│  │  │ Repo B  │ │ DB B    │ │ Proj B  │ │ (temp)  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Token Scoping

| Token | Scope | Lifetime |
|-------|-------|----------|
| GitHub Token | Single repo, contents:write only | 24 hours, auto-refresh |
| Convex Deploy Key | Single project | Permanent, revokable |
| EAS Token | Single project | 24 hours, auto-refresh |
| ANTHROPIC_API_KEY | Worker use only | Per-request |

### VM Isolation

- Each VM runs in isolated container (Fly.io machine or Railway service)
- No network access except:
  - Central Convex API
  - GitHub API (for assigned repo only)
  - Convex deployment API (for assigned project only)
  - Expo/EAS API (for assigned project only)
  - Anthropic API
- Filesystem wiped after each request
- 30-minute idle timeout, then terminated

---

## Pricing Model

```
┌─────────────────────────────────────────────────────────────────┐
│  FREE TIER                                                       │
│  - 1 project                                                    │
│  - 10 requests/day                                              │
│  - 5 checkpoints retained                                       │
│  - Community support                                            │
│  - "Built with Become" badge                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PRO - $29/month                                                 │
│  - 5 projects                                                   │
│  - 100 requests/day                                             │
│  - 50 checkpoints retained                                      │
│  - Priority queue (faster builds)                               │
│  - Remove badge                                                 │
│  - Email support                                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TEAM - $99/month                                                │
│  - Unlimited projects                                           │
│  - Unlimited requests                                           │
│  - Unlimited checkpoints                                        │
│  - Dedicated VM pool                                            │
│  - Custom domain                                                │
│  - App Store submission assistance                              │
│  - Slack support                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Loop (Week 1-2)

**Goal**: Voice → Agent → Claude Code → Deploy works for a single hardcoded project

- [ ] Become shell app with voice recording (Deepgram)
- [ ] Central Convex with @convex-dev/agent for dialogue
- [ ] Planner agent that clarifies requests and queues builds
- [ ] @convex-dev/workpool for build job queue
- [ ] Modal worker function that runs Claude Code
- [ ] HTTP endpoint for progress updates from worker
- [ ] Manual project provisioning (GitHub repo, Convex project)
- [ ] EAS update deployment
- [ ] Real-time progress streaming via Convex subscriptions

**Success Criteria**: Say "add a button", agent asks where, you clarify, it builds

### Phase 2: Provisioning (Week 3-4)

**Goal**: New users can create their own projects from scratch

- [ ] GitHub repo creation from template (via GitHub App)
- [ ] Convex project provisioning via API
- [ ] EAS project creation and linking
- [ ] Scoped token generation and secure storage (encrypted in Convex)
- [ ] Onboarding flow in shell app
- [ ] Initial project generation from description (first Claude Code run)

**Success Criteria**: New user can start from "npm run become" and have working app

### Phase 3: Reliability (Week 5-6)

**Goal**: System is robust and handles errors gracefully

- [ ] Checkpoint system with git tags
- [ ] Rollback functionality (git reset + schema restore)
- [ ] Workpool retry configuration tuning
- [ ] Dead letter queue monitoring
- [ ] Error recovery and user notification
- [ ] Request timeout handling (30 min max)

**Success Criteria**: App survives failures, users can always recover

### Phase 4: Intelligence (Week 7-8)

**Goal**: AI is smarter about what to build and how

- [ ] Agent learns user preferences over time
- [ ] Agent maintains project state awareness (screens, features, schema)
- [ ] Self code review after builds (agent-triggered)
- [ ] UX design review after builds
- [ ] Agent batches rapid-fire requests intelligently
- [ ] Agent suggests related features ("Want me to also add...?")
- [ ] Test generation and running

**Success Criteria**: Agent feels like a smart collaborator, not a command executor

### Phase 5: Polish (Week 9-10)

**Goal**: Production-ready product

- [ ] User authentication (email/social)
- [ ] Stripe integration
- [ ] Usage metering and limits
- [ ] Multiple projects per user
- [ ] Project sharing/collaboration
- [ ] App Store build generation

**Success Criteria**: Ready for public launch

---

## Template Repository Structure

```
become-template/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Main screen (Claude builds here)
│   │   ├── settings.tsx       # Settings (pre-built)
│   │   └── _layout.tsx        # Tab navigation
│   ├── _layout.tsx            # Root layout with providers
│   └── +not-found.tsx
├── components/
│   └── .gitkeep               # Claude adds components here
├── convex/
│   ├── schema.ts              # Minimal starting schema
│   ├── functions.ts           # Claude adds functions here
│   └── convex.config.ts
├── lib/
│   ├── convex.tsx             # Convex provider setup
│   └── utils.ts
├── assets/
│   └── icon.png
├── hooks/
│   └── .gitkeep
├── CLAUDE.md                  # Instructions for Claude Code
├── package.json
├── tsconfig.json
├── app.json                   # Expo config (EAS project ID injected)
└── eas.json                   # EAS build config
```

### Template CLAUDE.md

```markdown
# Become Project

This is a Become-managed project. You are Claude Code, building this app based on user voice requests.

## Tech Stack
- React Native 0.81 + Expo 54
- expo-router for navigation
- Convex for backend
- TypeScript

## Rules
1. Keep code simple and readable
2. Use functional components with hooks
3. Put new screens in app/(tabs)/ or app/
4. Put reusable components in components/
5. Put Convex functions in convex/
6. Always update schema.ts when adding new data
7. Test that the app builds after changes
8. Write brief comments explaining complex logic

## Current App Description
[INJECTED: User's app description]

## File Purposes
- app/(tabs)/index.tsx: Main screen, modify freely
- app/(tabs)/settings.tsx: User settings, built-in
- convex/schema.ts: Database schema, extend as needed
- convex/functions.ts: Backend functions, add here

## Common Patterns

### Adding a new screen
1. Create app/(tabs)/newscreen.tsx
2. Export default function component
3. Tab will auto-appear (expo-router)

### Adding data storage
1. Add table to convex/schema.ts
2. Create query/mutation in convex/functions.ts
3. Use useQuery/useMutation in component

### Styling
Use inline styles or StyleSheet.create. Keep it simple.
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Claude generates broken code | Self-review + test step, rollback capability |
| Runaway costs (API/infra) | Per-user rate limits, request quotas |
| Security breach in user code | Isolated per-project infra, no cross-project access |
| VM abuse | Network isolation, timeout enforcement, no shell access |
| Convex API limits | Batch operations, queue management |
| User creates malicious app | Content moderation on requests, ToS enforcement |
| GitHub rate limits | Token pooling, request caching |
| EAS build queue delays | Pre-build common configurations, use updates not builds |

---

## Success Metrics

| Metric | Target (Launch) | Target (6 months) |
|--------|-----------------|-------------------|
| Time to first working app | < 5 minutes | < 2 minutes |
| Request success rate | > 80% | > 95% |
| Avg request completion time | < 3 minutes | < 1 minute |
| User retention (7-day) | 30% | 50% |
| Projects created per user | 1.5 | 3 |
| Requests per project | 10 | 50 |

---

## Open Questions

1. **Native builds**: How do we handle features requiring native code (camera, etc.)?
   - Option A: Pre-include common native modules in template
   - Option B: Use EAS Build for native changes (slower)
   - Option C: Limit to Expo-compatible features only

2. **Collaboration**: How do multiple users work on one project?
   - Real-time conflict resolution needed
   - Request queuing per project already handles serialization

3. **Custom domains**: How do users publish to their own domains?
   - Web builds only, or custom Expo updates URL

4. **Offline support**: Can the app work without internet?
   - Optimistic UI with queue could work
   - But Claude needs internet...

5. **Analytics**: How do users understand their app's usage?
   - Built-in Convex dashboard?
   - Custom analytics screen?

---

## Appendix: API Reference

### Central Convex API

```typescript
// User management
api.users.create({ email, name })
api.users.get()
api.users.updatePlan({ plan })

// Project management
api.projects.create({ name, description })
api.projects.list()
api.projects.get({ projectId })
api.projects.archive({ projectId })

// Requests
api.requests.submit({ projectId, transcript })
api.requests.list({ projectId })
api.requests.get({ requestId })
api.requests.cancel({ requestId })

// Checkpoints
api.checkpoints.list({ projectId })
api.checkpoints.rollback({ projectId, checkpointId })

// Conversations
api.conversations.list({ projectId })
api.conversations.clear({ projectId })
```

### VM Worker API (Internal)

```typescript
internal.requests.claim({ vmId })
internal.requests.updateProgress({ requestId, status, percent, message })
internal.requests.appendLog({ requestId, message, type })
internal.requests.complete({ requestId, commitHash, checkpointId, easUpdateId })
internal.requests.fail({ requestId, error, errorDetails })

internal.vms.register({ instanceId, provider })
internal.vms.heartbeat({ vmId })
internal.vms.release({ vmId })
```
