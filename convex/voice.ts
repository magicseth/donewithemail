"use node";

import { action } from "./_generated/server";

// Get Deepgram API key for client-side transcription
// In production, you might want to create temporary tokens instead
export const getDeepgramKey = action({
  args: {},
  handler: async (): Promise<{ apiKey: string }> => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY environment variable not set");
    }

    // Note: For production, consider using Deepgram's API to create
    // short-lived project keys instead of exposing the main API key.
    // See: https://developers.deepgram.com/docs/create-additional-api-keys

    return { apiKey };
  },
});
