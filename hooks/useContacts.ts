import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useCallback } from "react";

/**
 * Hook for fetching a single contact
 */
export function useContact(contactId: Id<"contacts"> | undefined) {
  return useQuery(
    api.contacts.getContact,
    contactId ? { contactId } : "skip"
  );
}

/**
 * Hook for fetching contact by email
 */
export function useContactByEmail(
  userId: Id<"users"> | undefined,
  email: string | undefined
) {
  return useQuery(
    api.contacts.getContactByEmail,
    userId && email ? { userId, email } : "skip"
  );
}

/**
 * Hook for fetching all contacts
 */
export function useContacts(userId: Id<"users"> | undefined) {
  return useQuery(
    api.contacts.getContacts,
    userId ? { userId, limit: 100 } : "skip"
  );
}

/**
 * Hook for fetching VIP contacts
 */
export function useVIPContacts(userId: Id<"users"> | undefined) {
  return useQuery(
    api.contacts.getVIPContacts,
    userId ? { userId } : "skip"
  );
}

/**
 * Hook for fetching contact stats by ID
 */
export function useContactStats(contactId: Id<"contacts"> | undefined) {
  return useQuery(
    api.contacts.getContactStats,
    contactId ? { contactId } : "skip"
  );
}

/**
 * Hook for fetching contact stats by email
 */
export function useContactStatsByEmail(email: string | undefined) {
  return useQuery(
    api.contacts.getContactStatsByEmail,
    email ? { email } : "skip"
  );
}

/**
 * Hook for updating contact relationship
 */
export function useUpdateRelationship() {
  const updateMutation = useMutation(api.contacts.updateRelationship);

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
