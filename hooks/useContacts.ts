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

/**
 * Hook for managing contact facts (dossier)
 */
export function useContactFacts(contactId: Id<"contacts"> | undefined) {
  const addFactMutation = useMutation(api.contacts.addFact);
  const updateFactMutation = useMutation(api.contacts.updateFact);
  const deleteFactMutation = useMutation(api.contacts.deleteFact);

  const addFact = useCallback(
    async (text: string, source: "manual" | "ai" = "manual", sourceEmailId?: Id<"emails">) => {
      if (!contactId) return;
      return addFactMutation({ contactId, text, source, sourceEmailId });
    },
    [contactId, addFactMutation]
  );

  const updateFact = useCallback(
    async (factId: string, text: string) => {
      if (!contactId) return;
      return updateFactMutation({ contactId, factId, text });
    },
    [contactId, updateFactMutation]
  );

  const deleteFact = useCallback(
    async (factId: string) => {
      if (!contactId) return;
      return deleteFactMutation({ contactId, factId });
    },
    [contactId, deleteFactMutation]
  );

  return { addFact, updateFact, deleteFact };
}

/**
 * Hook for managing contact commitments
 */
export function useContactCommitments(contactId: Id<"contacts"> | undefined) {
  const addCommitmentMutation = useMutation(api.contacts.addCommitment);
  const updateCommitmentStatusMutation = useMutation(api.contacts.updateCommitmentStatus);
  const deleteCommitmentMutation = useMutation(api.contacts.deleteCommitment);

  const addCommitment = useCallback(
    async (text: string, direction: "from_contact" | "to_contact", source: "manual" | "ai" = "manual", sourceEmailId?: Id<"emails">) => {
      if (!contactId) return;
      return addCommitmentMutation({ contactId, text, direction, source, sourceEmailId });
    },
    [contactId, addCommitmentMutation]
  );

  const updateCommitmentStatus = useCallback(
    async (commitmentId: string, status: "pending" | "completed") => {
      if (!contactId) return;
      return updateCommitmentStatusMutation({ contactId, commitmentId, status });
    },
    [contactId, updateCommitmentStatusMutation]
  );

  const deleteCommitment = useCallback(
    async (commitmentId: string) => {
      if (!contactId) return;
      return deleteCommitmentMutation({ contactId, commitmentId });
    },
    [contactId, deleteCommitmentMutation]
  );

  return { addCommitment, updateCommitmentStatus, deleteCommitment };
}
