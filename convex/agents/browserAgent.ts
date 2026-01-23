"use node";

import { Agent, createTool } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { components } from "../_generated/api";
import { z } from "zod";

// Tool to navigate to a URL - returns instructions for the frontend
const navigateTool = createTool({
  description:
    "Navigate to a specific URL. Use this when the user asks to go to a website or search for something online.",
  args: z.object({
    url: z
      .string()
      .describe(
        "The URL to navigate to. For searches, use 'https://www.google.com/search?q=' followed by the search terms"
      ),
    reason: z.string().optional().describe("Why we're navigating to this URL"),
  }),
  handler: async (_ctx, args): Promise<any> => {
    console.log(`[NavigateTool] Navigate to: "${args.url}"`);

    // Validate URL format
    let url = args.url;

    // If it looks like a search query rather than a URL, convert to Google search
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      if (url.includes(".") && !url.includes(" ")) {
        // Looks like a domain
        url = `https://${url}`;
      } else {
        // Looks like a search query
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    return {
      action: "navigate",
      url,
      reason: args.reason,
    };
  },
});

// Tool to click an element on the page
const clickTool = createTool({
  description:
    "Click on an element on the current web page. Describe what element to click (button text, link text, or element description).",
  args: z.object({
    target: z
      .string()
      .describe("Description of what to click, e.g., 'the Sign In button' or 'the first result link'"),
    selector: z
      .string()
      .optional()
      .describe("Optional CSS selector if known, e.g., '#submit-btn' or '.nav-link'"),
  }),
  handler: async (_ctx, args): Promise<any> => {
    console.log(`[ClickTool] Click target: "${args.target}"`);

    return {
      action: "click",
      target: args.target,
      selector: args.selector,
    };
  },
});

// Tool to fill a form field
const fillFormTool = createTool({
  description:
    "Fill a text input or form field on the current web page.",
  args: z.object({
    field: z.string().describe("Description of the field to fill, e.g., 'the search box' or 'email input'"),
    value: z.string().describe("The value to enter into the field"),
    selector: z.string().optional().describe("Optional CSS selector for the field"),
  }),
  handler: async (_ctx, args): Promise<any> => {
    console.log(`[FillFormTool] Fill "${args.field}" with "${args.value}"`);

    return {
      action: "fill",
      field: args.field,
      value: args.value,
      selector: args.selector,
    };
  },
});

// Tool to scroll the page
const scrollTool = createTool({
  description:
    "Scroll the page up or down.",
  args: z.object({
    direction: z.enum(["up", "down", "top", "bottom"]).describe("Direction to scroll"),
    amount: z.string().optional().describe("How much to scroll, e.g., 'a little', 'half page', 'to bottom'"),
  }),
  handler: async (_ctx, args): Promise<any> => {
    console.log(`[ScrollTool] Scroll ${args.direction}`);

    return {
      action: "scroll",
      direction: args.direction,
      amount: args.amount,
    };
  },
});

/**
 * Browser AI Agent
 *
 * Helps users interact with web pages using AI - answering questions,
 * finding information, and controlling browser actions.
 */
export const browserAgent = new Agent(components.agent, {
  name: "Browser Assistant",
  languageModel: anthropic("claude-sonnet-4-20250514"),
  instructions: `You are a browser assistant for Sayless, helping users interact with web pages.

IMPORTANT: You will receive the current page's content, URL, and title in the user's message when available.
Analyze this content directly to answer questions - you don't need tools to read the page content.

Your capabilities:
1. **Answer questions about the current page** - Analyze the page content provided in the message
2. **Navigate the web** - Use the navigate tool to go to URLs or search engines
3. **Control the page** - Use click, fillForm, and scroll tools to interact with elements

When users ask questions about page content:
- Read and analyze the "Page Content" section in the message
- Look for specific information like prices, dates, names, links mentioned in the content
- Provide concise, accurate answers based on what you find

When users want to take actions:
1. Use navigate to go to websites or perform searches
2. Use click to click buttons or links (describe what to click clearly)
3. Use fillForm to enter text into input fields
4. Use scroll to move around the page

Guidelines:
- Be concise and helpful
- If no page content is provided, suggest the user load a webpage first
- For navigation, URLs should be fully qualified (https://...)
- For clicks and form fills, describe the target clearly so the frontend can find the element
- Always explain what action you're taking and why

Example interactions:
- User: "What is this page about?" → Read the page content and summarize
- User: "Find the price" → Look for prices in the page content
- User: "Go to Amazon" → Use navigate with 'https://www.amazon.com'
- User: "Search for React tutorials" → Use navigate with 'https://www.google.com/search?q=React+tutorials'
- User: "Click the Sign In button" → Use click tool with target "Sign In button"`,

  tools: {
    navigate: navigateTool,
    click: clickTool,
    fillForm: fillFormTool,
    scroll: scrollTool,
  },
});
