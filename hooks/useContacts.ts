import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useCallback } from "react";

/**
 * Hook for fetching a single contact (authenticated)
 */
export function useContact(contactId: Id<"contacts"> | undefined) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.contacts.getMyContact,
    contactId && isAuthenticated && !isLoading ? { contactId } : "skip"
  );
}

/**
 * Hook for fetching contact by email (authenticated)
 */
export function useContactByEmail(email: string | undefined) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.contacts.getMyContactByEmail,
    email && isAuthenticated && !isLoading ? { email } : "skip"
  );
}

/**
 * Hook for fetching all contacts (authenticated)
 */
export function useContacts() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.contacts.getMyContacts,
    isAuthenticated && !isLoading ? { limit: 100 } : "skip"
  );
}

/**
 * Hook for fetching VIP contacts (authenticated)
 */
export function useVIPContacts() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.contacts.getMyVIPContacts,
    isAuthenticated && !isLoading ? {} : "skip"
  );
}

/**
 * Hook for fetching contact stats by ID (authenticated)
 */
export function useContactStats(contactId: Id<"contacts"> | undefined) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.contacts.getMyContactStats,
    contactId && isAuthenticated && !isLoading ? { contactId } : "skip"
  );
}

/**
 * Hook for fetching contact stats by email (authenticated)
 */
export function useContactStatsByEmail(email: string | undefined) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.contacts.getMyContactStatsByEmail,
    email && isAuthenticated && !isLoading ? { email } : "skip"
  );
}

/**
 * Hook for updating contact relationship (authenticated)
 */
export function useUpdateRelationship() {
  const updateMutation = useMutation(api.contacts.updateMyContactRelationship);

  const updateRelationship = useCallback(
    async (
      contactId: Id<"contacts">,
      relationship: "vip" | "regular" | "unknown"
    ) => {
      return updateMutation({ contactId, relationship });
    },
    [updateMutation]
  );

  return { updateRelationship };
}

/**
 * Combined hook for contact actions
 */
export function useContactActions() {
  const { updateRelationship } = useUpdateRelationship();

  return {
    updateRelationship,
    // Convenience methods
    markAsVIP: (contactId: Id<"contacts">) => updateRelationship(contactId, "vip"),
    markAsRegular: (contactId: Id<"contacts">) => updateRelationship(contactId, "regular"),
  };
}
