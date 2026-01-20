#!/usr/bin/env npx tsx
/**
 * Feature Request Watcher
 *
 * Watches Convex for pending feature requests and processes them with Claude Code.
 *
 * Usage:
 *   npx tsx scripts/feature-watcher.ts
 *
 * Environment:
 *   CONVEX_URL - Your Convex deployment URL (from .env.local or env)
 *
 * What it does:
 *   1. Polls Convex for pending feature requests
 *   2. For each request, creates a temp worktree
 *   3. Runs Claude Code with the feature description
 *   4. Runs EAS update
 *   5. Reports status back to Convex
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Load environment
const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  // Try to load from .env.local
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/CONVEX_URL=(.+)/);
    if (match) {
      process.env.CONVEX_URL = match[1].trim();
    }
  }
}

const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.error("Error: CONVEX_URL not found. Set it in environment or .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
const REPO_URL = "https://github.com/magicseth/tokmail.git"; // Adjust to your repo
const POLL_INTERVAL = 5000; // 5 seconds
const WORKTREE_BASE = path.join(os.tmpdir(), "tokmail-features");

console.log("🔄 Feature Request Watcher starting...");
console.log(`   Convex URL: ${convexUrl}`);
console.log(`   Repo: ${REPO_URL}`);
console.log(`   Worktree base: ${WORKTREE_BASE}`);
console.log("");

// Ensure worktree base exists
if (!fs.existsSync(WORKTREE_BASE)) {
  fs.mkdirSync(WORKTREE_BASE, { recursive: true });
}

async function processFeatureRequest(request: {
  _id: string;
  transcript: string;
}) {
  const workDir = path.join(WORKTREE_BASE, `feature-${request._id}`);

  console.log(`\n📝 Processing feature request: ${request._id}`);
  console.log(`   Transcript: "${request.transcript}"`);

  try {
    // Mark as processing
    await client.mutation(api.featureRequests.markProcessing, {
      id: request._id as any,
    });

    // Clone the repo (fresh copy)
    console.log(`\n📦 Cloning repo to ${workDir}...`);
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
    execSync(`git clone ${REPO_URL} ${workDir}`, { stdio: "inherit" });

    // Create a branch for this feature
    const branchName = `feature/voice-${request._id.slice(-8)}`;
    console.log(`\n🌿 Creating branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { cwd: workDir, stdio: "inherit" });

    // Run Claude Code with the feature description
    console.log(`\n🤖 Running Claude Code...`);
    const prompt = `Implement this feature request from the user:

"${request.transcript}"

After implementing:
1. Make sure the code compiles (run: npx tsc --noEmit)
2. Commit your changes with a descriptive message
3. Do NOT push to remote - I will handle that

Important: This is a React Native Expo app. Follow existing patterns in the codebase.`;

    await runClaudeCode(workDir, prompt);

    // Get the commit hash
    const commitHash = execSync("git rev-parse HEAD", {
      cwd: workDir,
      encoding: "utf-8",
    }).trim();
    console.log(`\n✅ Commit: ${commitHash}`);

    // Push the branch
    console.log(`\n📤 Pushing branch...`);
    execSync(`git push -u origin ${branchName}`, { cwd: workDir, stdio: "inherit" });

    // Run EAS update
    console.log(`\n📱 Running EAS update...`);
    const easOutput = execSync(
      `npx eas update --branch preview --message "Feature: ${request.transcript.slice(0, 50)}..."`,
      { cwd: workDir, encoding: "utf-8" }
    );

    // Extract update ID from output (if possible)
    const updateIdMatch = easOutput.match(/Update ID:\s*(\S+)/);
    const easUpdateId = updateIdMatch ? updateIdMatch[1] : undefined;

    // Mark as completed
    await client.mutation(api.featureRequests.markCompleted, {
      id: request._id as any,
      commitHash,
      easUpdateId,
      easUpdateMessage: `Feature: ${request.transcript.slice(0, 50)}...`,
    });

    console.log(`\n🎉 Feature request completed!`);
    console.log(`   Commit: ${commitHash}`);
    console.log(`   Branch: ${branchName}`);
    if (easUpdateId) {
      console.log(`   EAS Update: ${easUpdateId}`);
    }

    // Cleanup
    console.log(`\n🧹 Cleaning up...`);
    fs.rmSync(workDir, { recursive: true });

  } catch (error) {
    console.error(`\n❌ Error processing feature request:`, error);

    // Mark as failed
    await client.mutation(api.featureRequests.markFailed, {
      id: request._id as any,
      error: error instanceof Error ? error.message : String(error),
    });

    // Cleanup on error too
    if (fs.existsSync(workDir)) {
      try {
        fs.rmSync(workDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function runClaudeCode(cwd: string, prompt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Write prompt to a temp file to avoid shell escaping issues
    const promptFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);
    fs.writeFileSync(promptFile, prompt);

    const claude = spawn("claude", ["-p", promptFile, "--dangerously-skip-permissions"], {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        // Ensure Claude Code can find npm/node
        PATH: process.env.PATH,
      },
    });

    claude.on("close", (code) => {
      // Cleanup prompt file
      try {
        fs.unlinkSync(promptFile);
      } catch {
        // Ignore
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude Code exited with code ${code}`));
      }
    });

    claude.on("error", (err) => {
      reject(err);
    });
  });
}

async function poll() {
  try {
    const pending = await client.query(api.featureRequests.getPending, {});

    if (pending.length > 0) {
      console.log(`\n📬 Found ${pending.length} pending request(s)`);

      // Process one at a time
      for (const request of pending) {
        await processFeatureRequest(request);
      }
    }
  } catch (error) {
    console.error("Error polling for requests:", error);
  }
}

// Main loop
async function main() {
  console.log("👀 Watching for feature requests...\n");

  while (true) {
    await poll();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
