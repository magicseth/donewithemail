/**
 * Hook to get a friend suggestion to reconnect with
 * Supports both real Convex data and demo mode
 */
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useDemoMode } from "../lib/demoModeContext";
import type { ReconnectSuggestion } from "../components/batch/FriendReconnectCard";

interface UseFriendToReconnectResult {
  suggestion: ReconnectSuggestion | null;
  isLoading: boolean;
  dismiss: () => void;
  isDismissed: boolean;
}

export function useFriendToReconnect(): UseFriendToReconnectResult {
  const { isDemoMode, demoContacts } = useDemoMode();
  const [isDismissed, setIsDismissed] = useState(false);

  // Query real data when not in demo mode
  const realSuggestion = useQuery(
    api.contacts.getFriendToReconnect,
    isDemoMode ? "skip" : {}
  );

  // Generate demo suggestion
  const demoSuggestion = useMemo((): ReconnectSuggestion | null => {
    if (!isDemoMode || demoContacts.length === 0) return null;

    // Pick a random contact as a "friend to reconnect with"
    // In demo mode, simulate that they haven't been contacted in a while
    const contact = demoContacts[2]; // Emily Rodriguez - a "regular" contact
    if (!contact) return null;

    return {
      _id: contact._id,
      email: contact.email,
      name: contact.name,
      avatarUrl: contact.avatarUrl,
      lastEmailAt: Date.now() - 45 * 24 * 60 * 60 * 1000, // 45 days ago
      daysSinceContact: 45,
      emailCount: 12,
    };
  }, [isDemoMode, demoContacts]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const suggestion = isDemoMode ? demoSuggestion : realSuggestion ?? null;

  return {
    suggestion: isDismissed ? null : suggestion,
    isLoading: !isDemoMode && realSuggestion === undefined,
    dismiss,
    isDismissed,
  };
}
