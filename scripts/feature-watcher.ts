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
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

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
const REPO_URL = "https://github.com/magicseth/donewithemail.git"; // Adjust to your repo
const POLL_INTERVAL = 5000; // 5 seconds
const WORKTREE_BASE = path.join(os.tmpdir(), "tokmail-features");

// Get Convex deployment from environment or .env.local
let CONVEX_DEPLOYMENT = process.env.CONVEX_DEPLOYMENT;
let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
let EXPO_PUBLIC_CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");

  if (!CONVEX_DEPLOYMENT) {
    const match = envContent.match(/CONVEX_DEPLOYMENT=([^\s#]+)/);
    if (match) {
      CONVEX_DEPLOYMENT = match[1].trim();
    }
  }

  if (!ANTHROPIC_API_KEY) {
    const match = envContent.match(/ANTHROPIC_API_KEY=([^\s#]+)/);
    if (match) {
      ANTHROPIC_API_KEY = match[1].trim();
    }
  }

  if (!EXPO_PUBLIC_CONVEX_URL) {
    const match = envContent.match(/EXPO_PUBLIC_CONVEX_URL=([^\s#]+)/);
    if (match) {
      EXPO_PUBLIC_CONVEX_URL = match[1].trim();
    }
  }
}

if (!CONVEX_DEPLOYMENT) {
  console.error("Warning: CONVEX_DEPLOYMENT not found. Convex deploy may prompt interactively.");
}
if (!EXPO_PUBLIC_CONVEX_URL) {
  console.error("Warning: EXPO_PUBLIC_CONVEX_URL not found. Convex deploy may fail.");
}
if (!ANTHROPIC_API_KEY) {
  console.error("Warning: ANTHROPIC_API_KEY not found. Claude Code may not work.");
}

// Set env var so AI SDK can find it, then create client
process.env.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY;
const anthropic = createAnthropic();

console.log("🔄 Feature Request Watcher starting...");
console.log(`   Convex URL: ${convexUrl}`);
console.log(`   Convex Deployment: ${CONVEX_DEPLOYMENT || "(not set)"}`);
console.log(`   Expo Public Convex URL: ${EXPO_PUBLIC_CONVEX_URL || "(not set)"}`);
console.log(`   Anthropic API Key: ${ANTHROPIC_API_KEY ? "✓ found" : "(not set)"}`);
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

  const updateProgress = async (
    step: "cloning" | "implementing" | "pushing" | "merging" | "deploying_backend" | "uploading" | "ready",
    message: string,
    extra?: { branchName?: string; commitHash?: string }
  ) => {
    await client.mutation(api.featureRequests.updateProgress, {
      id: request._id as any,
      progressStep: step,
      progressMessage: message,
      ...extra,
    });
  };

  try {
    // Mark as processing
    await client.mutation(api.featureRequests.markProcessing, {
      id: request._id as any,
    });

    // Clone the repo (fresh copy)
    console.log(`\n📦 Cloning repo to ${workDir}...`);
    await updateProgress("cloning", "Cloning repository...");
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
    execSync(`git clone ${REPO_URL} ${workDir}`, { stdio: "inherit" });

    // Install dependencies
    console.log(`\n📦 Installing dependencies...`);
    execSync(`npm install`, { cwd: workDir, stdio: "inherit" });

    // Start from voice-preview merged with main (so Claude sees all previous voice features + latest main)
    console.log(`\n🔀 Preparing base: merging main and voice-preview...`);
    execSync(`git fetch origin voice-preview`, { cwd: workDir, stdio: "inherit" });
    execSync(`git checkout voice-preview`, { cwd: workDir, stdio: "inherit" });
    execSync(`git merge origin/main -m "Merge main into voice-preview (pre-feature)"`, {
      cwd: workDir,
      stdio: "inherit"
    });

    // Create a branch for this feature (from the merged state)
    const branchName = `feature/voice-${request._id.slice(-8)}`;
    console.log(`\n🌿 Creating branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { cwd: workDir, stdio: "inherit" });

    // Run Claude Code with the feature description
    console.log(`\n🤖 Running Claude Code...`);
    await updateProgress("implementing", "Claude is implementing your feature...", { branchName });
    const prompt = `Implement this feature request from the user:

"${request.transcript}"

After implementing:
1. Run \`npx convex dev --once\` to deploy Convex changes
2. Run \`npx tsc --noEmit\` to check for TypeScript errors
3. Fix any TypeScript errors you find
4. Commit your changes with a descriptive message
5. Do NOT push to remote - I will handle that

Important: This is a React Native Expo app. Follow existing patterns in the codebase.
Important: Do not consider the task complete until convex dev and tsc both pass without errors.`;

    let claudeResult = await runClaudeCode(workDir, prompt);
    let attempts = 1;
    const maxAttempts = 3;

    // Verify code compiles - retry if needed
    while (attempts <= maxAttempts) {
      console.log(`\n🔍 Verifying code compiles (attempt ${attempts}/${maxAttempts})...`);

      // Check Convex
      let convexError: string | null = null;
      try {
        execSync(`npx convex dev --once`, {
          cwd: workDir,
          encoding: "utf-8",
          env: {
            ...process.env,
            CONVEX_DEPLOYMENT: CONVEX_DEPLOYMENT || "",
            EXPO_PUBLIC_CONVEX_URL: EXPO_PUBLIC_CONVEX_URL || "",
          },
        });
        console.log(`   ✓ Convex deployment successful`);
      } catch (e) {
        convexError = e instanceof Error ? e.message : String(e);
        console.log(`   ✗ Convex deployment failed: ${convexError.slice(0, 200)}`);
      }

      // Check TypeScript
      let tscError: string | null = null;
      try {
        execSync(`npx tsc --noEmit`, { cwd: workDir, encoding: "utf-8" });
        console.log(`   ✓ TypeScript check passed`);
      } catch (e: any) {
        tscError = e.stdout || e.message || String(e);
        console.log(`   ✗ TypeScript errors found`);
      }

      // If both pass, we're done
      if (!convexError && !tscError) {
        console.log(`\n✅ Code verification passed!`);
        break;
      }

      // If we've exhausted attempts, fail
      if (attempts >= maxAttempts) {
        const errorMsg = [
          convexError ? `Convex: ${convexError.slice(0, 500)}` : null,
          tscError ? `TypeScript: ${tscError.slice(0, 500)}` : null,
        ].filter(Boolean).join("\n\n");

        console.log(`\n❌ Code verification failed after ${maxAttempts} attempts`);
        await client.mutation(api.featureRequests.updateClaudeOutput, {
          id: request._id as any,
          claudeOutput: claudeResult.output.slice(-5000),
          claudeSuccess: false,
        });
        await client.mutation(api.featureRequests.markFailed, {
          id: request._id as any,
          error: `Code verification failed:\n${errorMsg}`,
        });
        return;
      }

      // Try to fix the errors
      console.log(`\n🔧 Asking Claude to fix errors (attempt ${attempts + 1})...`);
      await updateProgress("implementing", `Fixing errors (attempt ${attempts + 1})...`);

      const fixPrompt = `The code has errors that need to be fixed:

${convexError ? `CONVEX DEPLOYMENT ERRORS:\n${convexError.slice(0, 2000)}\n\n` : ""}${tscError ? `TYPESCRIPT ERRORS:\n${tscError.slice(0, 2000)}` : ""}

Please fix these errors. After fixing:
1. Run \`npx convex dev --once\` to verify Convex works
2. Run \`npx tsc --noEmit\` to verify TypeScript compiles
3. Commit your fixes

Do not consider the task complete until both commands pass without errors.`;

      claudeResult = await runClaudeCode(workDir, fixPrompt);
      attempts++;
    }

    // Save Claude's output to Convex
    await client.mutation(api.featureRequests.updateClaudeOutput, {
      id: request._id as any,
      claudeOutput: claudeResult.output.slice(-5000), // Last 5000 chars
      claudeSuccess: claudeResult.success,
    });

    // Check if Claude succeeded before proceeding
    if (!claudeResult.success) {
      console.log(`\n⚠️ Claude did not indicate success. Stopping before merge/deploy.`);
      console.log(`   Exit code: ${claudeResult.exitCode}`);
      await client.mutation(api.featureRequests.markFailed, {
        id: request._id as any,
        error: `Claude did not complete successfully (exit code: ${claudeResult.exitCode})`,
      });
      return;
    }

    console.log(`\n✅ Claude completed successfully!`);

    // Get the commit hash
    const commitHash = execSync("git rev-parse HEAD", {
      cwd: workDir,
      encoding: "utf-8",
    }).trim();
    console.log(`\n✅ Commit: ${commitHash}`);

    // Push the feature branch (for reference)
    console.log(`\n📤 Pushing feature branch...`);
    await updateProgress("pushing", "Pushing feature branch...", { commitHash });
    execSync(`git push -u origin ${branchName}`, { cwd: workDir, stdio: "inherit" });

    // Merge into voice-preview branch (first merge main to get latest features)
    console.log(`\n🔀 Merging into voice-preview...`);
    await updateProgress("merging", "Merging main into voice-preview...");
    execSync(`git fetch origin voice-preview main`, { cwd: workDir, stdio: "inherit" });
    execSync(`git checkout voice-preview`, { cwd: workDir, stdio: "inherit" });

    // First merge main into voice-preview to get latest features
    console.log(`   Merging main into voice-preview first...`);
    execSync(`git merge origin/main -m "Merge main into voice-preview"`, {
      cwd: workDir,
      stdio: "inherit"
    });

    // Then merge the feature branch
    console.log(`   Merging feature branch...`);
    await updateProgress("merging", "Merging feature branch...");
    execSync(`git merge ${branchName} -m "Merge ${branchName}: ${request.transcript.slice(0, 50)}..."`, {
      cwd: workDir,
      stdio: "inherit"
    });
    execSync(`git push origin voice-preview`, { cwd: workDir, stdio: "inherit" });

    // Deploy Convex changes
    console.log(`\n☁️ Deploying Convex...`);
    await updateProgress("deploying_backend", "Deploying backend changes...");
    execSync(`npx convex dev --once`, {
      cwd: workDir,
      stdio: "inherit",
      env: {
        ...process.env,
        CONVEX_DEPLOYMENT: CONVEX_DEPLOYMENT || "",
        EXPO_PUBLIC_CONVEX_URL: EXPO_PUBLIC_CONVEX_URL || "",
      },
    });

    // Run EAS update on production channel
    console.log(`\n📱 Running EAS update for production...`);
    await updateProgress("uploading", "Uploading to Expo (EAS Update)...");
    const easOutput = execSync(
      `npx eas update --branch production --message "Feature: ${request.transcript.slice(0, 50)}..."`,
      { cwd: workDir, encoding: "utf-8" }
    );

    // Extract update ID and dashboard URL from output
    const updateGroupMatch = easOutput.match(/Update group ID\s+(\S+)/);
    const easUpdateId = updateGroupMatch ? updateGroupMatch[1] : undefined;
    const dashboardMatch = easOutput.match(/EAS Dashboard\s+(https:\/\/\S+)/);
    const easDashboardUrl = dashboardMatch ? dashboardMatch[1] : undefined;

    // Mark as completed
    await client.mutation(api.featureRequests.markCompleted, {
      id: request._id as any,
      commitHash,
      branchName,
      easUpdateId,
      easUpdateMessage: `Feature: ${request.transcript.slice(0, 50)}...`,
      easDashboardUrl,
    });

    console.log(`\n🎉 Feature request completed!`);
    console.log(`   Commit: ${commitHash}`);
    console.log(`   Branch: ${branchName}`);
    if (easUpdateId) {
      console.log(`   EAS Update: ${easUpdateId}`);
    }
    if (easDashboardUrl) {
      console.log(`   Dashboard: ${easDashboardUrl}`);
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

interface ClaudeResult {
  output: string;
  success: boolean;
  exitCode: number;
}

function runClaudeCode(cwd: string, prompt: string): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    // Write prompt to a temp file to avoid shell escaping issues
    const promptFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);
    fs.writeFileSync(promptFile, prompt);

    let fullOutput = "";

    const claude = spawn("claude", ["-p", promptFile, "--dangerously-skip-permissions"], {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      env: {
        ...process.env,
        // Ensure Claude Code can find npm/node
        PATH: process.env.PATH,
        // Force color output
        FORCE_COLOR: "1",
        // Pass Anthropic API key for Claude Code
        ANTHROPIC_API_KEY: ANTHROPIC_API_KEY || "",
      },
    });

    // Stream and capture stdout
    claude.stdout?.on("data", (data) => {
      const text = data.toString();
      fullOutput += text;
      process.stdout.write(text);
    });

    // Stream and capture stderr
    claude.stderr?.on("data", (data) => {
      const text = data.toString();
      fullOutput += text;
      process.stderr.write(text);
    });

    claude.on("close", (code) => {
      // Cleanup prompt file
      try {
        fs.unlinkSync(promptFile);
      } catch {
        // Ignore
      }

      // Check if Claude indicated success in its output
      // Strip ANSI codes for cleaner matching
      const cleanOutput = fullOutput.replace(/\x1b\[[0-9;]*m/g, "");

      const successIndicators = [
        /\bdone\b\.?/i,           // "Done" or "Done."
        /\bfixed\b/i,             // "fixed" as whole word
        /\bimplemented\b/i,
        /\bcompleted\b/i,
        /commit.*made/i,
        /ready.*push/i,
        /changes.*committed/i,
        /has been (created|made|committed)/i,
        /successfully/i,
      ];

      // Be more specific about failure - look for phrases that indicate Claude failed
      const failureIndicators = [
        /\bfailed to\b/i,         // "failed to" not just "failed"
        /\berror occurred\b/i,
        /\bcould not (implement|fix|complete)/i,
        /\bunable to (implement|fix|complete)/i,
        /\bcannot (implement|fix|complete)/i,
        /i('m| am) (unable|not able)/i,
        /did not succeed/i,
      ];

      const hasSuccessIndicator = successIndicators.some((re) => re.test(cleanOutput));
      const hasFailureIndicator = failureIndicators.some((re) => re.test(cleanOutput));
      const success = code === 0 && hasSuccessIndicator && !hasFailureIndicator;

      resolve({
        output: fullOutput,
        success,
        exitCode: code || 0,
      });
    });

    claude.on("error", (err) => {
      reject(err);
    });
  });
}

interface PendingRequest {
  _id: string;
  transcript: string;
}

interface CombinationResult {
  primaryId: string;
  combinedIds: string[];
  combinedTranscript: string;
}

/**
 * Use Claude to analyze pending requests and identify ones that should be combined
 */
async function findSimilarRequests(pending: PendingRequest[]): Promise<CombinationResult | null> {
  if (pending.length < 2) {
    return null;
  }

  console.log(`\n🔍 Analyzing ${pending.length} pending requests for similar features...`);

  const requestList = pending.map((r, i) => `${i + 1}. ID: ${r._id}\n   Transcript: "${r.transcript}"`).join("\n\n");

  const prompt = `You are helping optimize a feature request queue. Analyze these pending feature requests and determine if any should be combined because they're similar in scope or would benefit from being implemented together.

FEATURE REQUESTS:
${requestList}

RULES:
1. Only combine requests that are genuinely related or would benefit from being implemented together
2. Don't combine unrelated features just to be efficient
3. If requests should be combined, provide a combined transcript that includes both features clearly

Respond in JSON format only:
{
  "shouldCombine": boolean,
  "reason": "brief explanation",
  "primaryIndex": number (1-based index of the request that will be kept, usually the first/oldest),
  "combineIndices": [array of 1-based indices of requests to combine into primary],
  "combinedTranscript": "combined feature description if shouldCombine is true, otherwise null"
}

Example response if combining:
{"shouldCombine": true, "reason": "Both features relate to email filtering", "primaryIndex": 1, "combineIndices": [2], "combinedTranscript": "Add email filtering with both sender-based rules and keyword-based rules"}

Example response if not combining:
{"shouldCombine": false, "reason": "Features are unrelated", "primaryIndex": null, "combineIndices": [], "combinedTranscript": null}`;

  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
    });

    // Strip markdown code blocks if present
    let jsonText = text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonText);

    if (!result.shouldCombine) {
      console.log(`   ✓ No similar requests found: ${result.reason}`);
      return null;
    }

    const primaryRequest = pending[result.primaryIndex - 1];
    const combinedRequests = result.combineIndices.map((i: number) => pending[i - 1]);

    console.log(`   🔗 Found similar requests to combine!`);
    console.log(`   Primary: "${primaryRequest.transcript.slice(0, 50)}..."`);
    for (const req of combinedRequests) {
      console.log(`   Combined: "${req.transcript.slice(0, 50)}..."`);
    }
    console.log(`   Reason: ${result.reason}`);

    return {
      primaryId: primaryRequest._id,
      combinedIds: combinedRequests.map((r: PendingRequest) => r._id),
      combinedTranscript: result.combinedTranscript,
    };
  } catch (e) {
    console.log(`   Failed to analyze requests: ${e}`);
    return null;
  }
}

async function poll() {
  try {
    const pending = await client.query(api.featureRequests.getPending, {});

    if (pending.length > 0) {
      console.log(`\n📬 Found ${pending.length} pending request(s)`);

      // Check if any requests should be combined
      if (pending.length >= 2) {
        const combination = await findSimilarRequests(pending);

        if (combination) {
          // Update the primary request's transcript
          console.log(`\n🔗 Combining requests...`);
          await client.mutation(api.featureRequests.updateTranscript, {
            id: combination.primaryId as any,
            transcript: combination.combinedTranscript,
          });

          // Mark other requests as combined
          for (const combinedId of combination.combinedIds) {
            await client.mutation(api.featureRequests.markCombined, {
              id: combinedId as any,
              combinedIntoId: combination.primaryId as any,
            });
            console.log(`   ✓ Marked ${combinedId} as combined into ${combination.primaryId}`);
          }

          // Re-fetch pending requests (some are now combined)
          const remainingPending = await client.query(api.featureRequests.getPending, {});

          // Process the combined request
          for (const request of remainingPending) {
            await processFeatureRequest(request);
          }
          return;
        }
      }

      // Process one at a time (no combining)
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
