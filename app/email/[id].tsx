import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EmailCard, EmailCardData, CalendarEventData } from "../../components/EmailCard";
import { useEmail, useEmailActions, useThreadEmails } from "../../hooks/useEmails";
import { useAuth } from "../../lib/authContext";
import { Id } from "../../convex/_generated/dataModel";
import { AttachmentData } from "../../components/AttachmentList";

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Check if an ID looks like a valid Convex ID (not a Gmail ID)
function isConvexId(id: string): boolean {
  // Convex IDs are longer and contain special characters
  // Gmail IDs are typically hex strings like "19bcec856e234249"
  return id.length > 20 || !id.match(/^[0-9a-f]+$/i);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [fullBodies, setFullBodies] = useState<Record<string, string>>({});
  const [loadingBodies, setLoadingBodies] = useState<Set<string>>(new Set());
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [meetingAvailability, setMeetingAvailability] = useState<Array<{
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    conflicts: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      htmlLink: string;
    }>;
  }> | undefined>();

  const { user } = useAuth();
  const fetchEmailBody = useAction(api.gmailSync.fetchEmailBody);
  const addToCalendar = useAction(api.calendar.addToCalendar);
  const checkExistingCalendarEvents = useAction(api.calendar.checkExistingCalendarEvents);
  const checkMeetingAvailability = useAction((api.calendar as any).checkMeetingAvailability);
  const reprocessEmail = useAction(api.summarizeActions.reprocessEmail);

  // Look up email by Convex ID (authenticated)
  const isConvex = id ? isConvexId(id) : false;
  const email = useEmail(isConvex ? (id as Id<"emails">) : undefined);
  const { archiveEmail, markReplyNeeded } = useEmailActions();

  // Fetch all emails in this thread
  const threadEmails = useThreadEmails(email?._id);

  // Use the Convex _id from the email object for mutations
  const convexId = email?._id;

  // Fetch attachments for this email
  const attachments = useQuery(
    (api as any).attachments?.getEmailAttachments,
    convexId ? { emailId: convexId } : "skip"
  );

  // Fetch full body for the current email and thread emails
  useEffect(() => {
    async function fetchBodies() {
      if (!user?.email) return;

      const emailsToFetch = threadEmails && threadEmails.length > 1
        ? threadEmails
        : email ? [email] : [];

      for (const e of emailsToFetch) {
        // Skip if already fetched or loading
        if (fullBodies[e._id] || loadingBodies.has(e._id)) continue;

        setLoadingBodies(prev => new Set(prev).add(e._id));
        try {
          const result = await fetchEmailBody({
            userEmail: user.email,
            emailId: e._id as Id<"emails">,
          });
          setFullBodies(prev => ({ ...prev, [e._id]: result.body }));
        } catch (err) {
          console.error("Failed to fetch email body:", err);
        } finally {
          setLoadingBodies(prev => {
            const next = new Set(prev);
            next.delete(e._id);
            return next;
          });
        }
      }
    }

    fetchBodies();
  }, [email, threadEmails, user?.email, fetchEmailBody, fullBodies, loadingBodies]);

  // Check meeting availability when email has a meeting request
  useEffect(() => {
    async function checkAvailability() {
      if (!user?.email || !email?.meetingRequest?.isMeetingRequest || !email.meetingRequest.proposedTimes) {
        return;
      }

      try {
        const availability = await checkMeetingAvailability({
          userEmail: user.email,
          proposedTimes: email.meetingRequest.proposedTimes,
        });
        setMeetingAvailability(availability);
      } catch (err) {
        console.error("Failed to check meeting availability:", err);
        // Set all as available on error
        setMeetingAvailability(email.meetingRequest.proposedTimes.map((time: any) => ({
          ...time,
          isAvailable: true,
          conflicts: [],
        })));
      }
    }

    checkAvailability();
  }, [email?.meetingRequest, user?.email, checkMeetingAvailability]);

  const toggleExpanded = useCallback((emailId: string) => {
    setExpandedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const handleArchive = useCallback(async () => {
    if (convexId) {
      await archiveEmail(convexId);
      router.back();
    }
  }, [convexId, archiveEmail]);

  const handleReply = useCallback(() => {
    if (!email) return;
    const replyTo = email.fromContact?.email || "";
    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;
    router.push({
      pathname: "/compose",
      params: {
        replyTo,
        subject,
        emailId: email._id,
      },
    });
  }, [email]);

  const handleAddToCalendar = useCallback(async (event: CalendarEventData, skipDuplicateCheck = false) => {
    if (!user?.email) {
      showAlert("Error", "Not signed in");
      return;
    }

    // Get client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

    setIsAddingToCalendar(true);
    try {
      // Check for existing similar events on the calendar (unless skipping)
      if (!skipDuplicateCheck) {
        const existingCheck = await checkExistingCalendarEvents({
          userEmail: user.email,
          title: event.title,
          startTime: event.startTime,
          timezone,
        });

        if (existingCheck.exists && existingCheck.similarEvents.length > 0) {
          setIsAddingToCalendar(false);
          const similarEvent = existingCheck.similarEvents[0];
          const similarTime = similarEvent.startTime
            ? new Date(similarEvent.startTime).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "";

          // Ask user if they want to add anyway
          if (Platform.OS === "web") {
            const addAnyway = window.confirm(
              `A similar event already exists on your calendar:\n\n"${similarEvent.title}"${similarTime ? `\n${similarTime}` : ""}\n\nDo you want to add this event anyway?`
            );
            if (addAnyway) {
              // Re-call with skip flag
              handleAddToCalendar(event, true);
            }
          } else {
            Alert.alert(
              "Similar Event Found",
              `A similar event already exists on your calendar:\n\n"${similarEvent.title}"${similarTime ? `\n${similarTime}` : ""}`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Add Anyway",
                  onPress: () => handleAddToCalendar(event, true),
                },
                {
                  text: "View Existing",
                  onPress: () => {
                    if (similarEvent.htmlLink) {
                      if (Platform.OS === "web") {
                        window.open(similarEvent.htmlLink, "_blank");
                      }
                    }
                  },
                },
              ]
            );
          }
          return;
        }
      }

      const result = await addToCalendar({
        userEmail: user.email,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        description: event.description,
        timezone,
        emailId: convexId,
        recurrence: event.recurrence,
      });
      // Open the calendar link on web
      if (Platform.OS === "web" && result.htmlLink) {
        window.open(result.htmlLink, "_blank");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add event";
      showAlert("Error", message);
      console.error("Failed to add to calendar:", err);
    } finally {
      setIsAddingToCalendar(false);
    }
  }, [user?.email, addToCalendar, checkExistingCalendarEvents, convexId]);

  const handleSelectMeetingTime = useCallback(async (startTime: string, endTime: string) => {
    if (!user?.email || !email) {
      showAlert("Error", "Not signed in");
      return;
    }

    // Get client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

    setIsAddingToCalendar(true);
    try {
      // Create calendar event with the selected time
      const result = await addToCalendar({
        userEmail: user.email,
        title: email.subject || "Meeting",
        startTime,
        endTime,
        description: `Meeting scheduled from email: ${email.subject}`,
        timezone,
        emailId: convexId,
      });

      // Show success message
      showAlert("Success", "Meeting added to your calendar!");

      // Open the calendar link on web
      if (Platform.OS === "web" && result.htmlLink) {
        window.open(result.htmlLink, "_blank");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add meeting";
      showAlert("Error", message);
      console.error("Failed to add meeting to calendar:", err);
    } finally {
      setIsAddingToCalendar(false);
    }
  }, [user?.email, email, addToCalendar, convexId]);

  const handleContactPress = useCallback((contactId?: string) => {
    if (contactId) {
      router.push(`/person/${contactId}`);
    } else if (email?.direction === "outgoing" && (email as any).toContacts?.[0]?._id) {
      // Fallback for single email view
      router.push(`/person/${(email as any).toContacts[0]._id}`);
    } else if (email?.fromContact?._id) {
      router.push(`/person/${email.fromContact._id}`);
    }
  }, [email]);

  const handleReprocess = useCallback(async () => {
    if (!convexId || !user?.email) {
      showAlert("Error", "Cannot reprocess - missing email or user");
      return;
    }

    setIsReprocessing(true);
    try {
      const result = await reprocessEmail({
        emailId: convexId,
        userEmail: user.email,
      });

      if (result.success) {
        showAlert("Success", "Email reprocessed successfully. Refresh to see updates.");
      } else {
        showAlert("Error", result.error || "Failed to reprocess email");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reprocess";
      showAlert("Error", message);
      console.error("Failed to reprocess email:", err);
    } finally {
      setIsReprocessing(false);
    }
  }, [convexId, user?.email, reprocessEmail]);

  // Mock data for development
  const mockEmail: EmailCardData = {
    _id: id || "1",
    subject: "Q4 Planning Meeting - Action Items",
    bodyPreview:
      "Hi team,\n\nFollowing up on our Q4 planning meeting, here are the key action items we discussed:\n\n1. Review budget allocations by Friday\n2. Submit project proposals by next Monday\n3. Schedule one-on-ones with direct reports\n4. Update quarterly goals in the system\n\nPlease review and let me know if I missed anything important. Looking forward to a productive quarter!\n\nBest,\nSarah",
    receivedAt: Date.now() - 3600000,
    isRead: true,
    summary:
      "Follow-up from Q4 planning meeting with 4 key action items: review budget (Friday), submit proposals (Monday), schedule 1:1s, and update quarterly goals.",
    urgencyScore: 65,
    urgencyReason:
      "Contains action items with specific deadlines (Friday and Monday)",
    suggestedReply:
      "Thanks Sarah! I've noted all the action items. I'll have the budget review done by Friday and proposals ready by Monday. Let me know if you need anything else.",
    fromContact: {
      _id: "c1",
      email: "sarah@company.com",
      name: "Sarah Chen",
      relationship: "vip",
    },
  };

  const displayEmail = email
    ? {
        _id: email._id,
        subject: email.subject,
        bodyPreview: fullBodies[email._id] || email.bodyPreview,
        receivedAt: email.receivedAt,
        isRead: email.isRead,
        summary: email.summary,
        urgencyScore: email.urgencyScore,
        urgencyReason: email.urgencyReason,
        suggestedReply: email.suggestedReply,
        calendarEvent: email.calendarEvent ? {
          ...email.calendarEvent,
          calendarEventId: (email as any).calendarEventId,
          calendarEventLink: (email as any).calendarEventLink,
        } : undefined,
        fromName: email.fromName,
        fromContact: email.fromContact
          ? {
              _id: email.fromContact._id,
              email: email.fromContact.email,
              name: email.fromContact.name,
              avatarUrl: email.fromContact.avatarUrl,
              relationship: email.fromContact.relationship as "vip" | "regular" | "unknown" | undefined,
            }
          : undefined,
        direction: email.direction,
        toContacts: (email as any).toContacts?.map((c: any) => ({
          _id: c._id,
          email: c.email,
          name: c.name,
          avatarUrl: c.avatarUrl,
        })),
        attachments: attachments as AttachmentData[] | undefined,
        userEmail: user?.email,
      }
    : mockEmail;

  if (email === undefined && !mockEmail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerRight: () => (
            <View style={styles.headerButtonGroup}>
              <TouchableOpacity
                onPress={handleReprocess}
                style={styles.headerButton}
                disabled={isReprocessing}
              >
                {isReprocessing ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text style={styles.headerButtonText}>Reprocess</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleArchive} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Archive</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.container}>
        {/* Thread header if multiple emails */}
        {threadEmails && threadEmails.length > 1 && (
          <View style={styles.threadHeader}>
            <Text style={styles.threadHeaderText}>
              {threadEmails.length} messages in thread
            </Text>
          </View>
        )}

        {/* Show all thread emails */}
        {threadEmails && threadEmails.length > 1 ? (
          threadEmails.map((threadEmail: any, index: number) => {
            const isCurrentEmail = threadEmail._id === id;
            const isLastEmail = index === threadEmails.length - 1;
            const isExpanded = isCurrentEmail || isLastEmail || expandedEmails.has(threadEmail._id);

            const emailData: EmailCardData = {
              _id: threadEmail._id,
              subject: threadEmail.subject,
              bodyPreview: fullBodies[threadEmail._id] || threadEmail.bodyPreview,
              receivedAt: threadEmail.receivedAt,
              isRead: threadEmail.isRead,
              summary: threadEmail.summary,
              urgencyScore: threadEmail.urgencyScore,
              urgencyReason: threadEmail.urgencyReason,
              suggestedReply: threadEmail.suggestedReply,
              calendarEvent: threadEmail.calendarEvent ? {
                ...threadEmail.calendarEvent,
                calendarEventId: (threadEmail as any).calendarEventId,
                calendarEventLink: (threadEmail as any).calendarEventLink,
              } : undefined,
              fromName: threadEmail.fromName,
              fromContact: threadEmail.fromContact
                ? {
                    _id: threadEmail.fromContact._id,
                    email: threadEmail.fromContact.email,
                    name: threadEmail.fromContact.name,
                    avatarUrl: threadEmail.fromContact.avatarUrl,
                    relationship: threadEmail.fromContact.relationship as "vip" | "regular" | "unknown" | undefined,
                  }
                : undefined,
              direction: threadEmail.direction,
              toContacts: (threadEmail as any).toContacts?.map((c: any) => ({
                _id: c._id,
                email: c.email,
                name: c.name,
                avatarUrl: c.avatarUrl,
              })),
              userEmail: user?.email,
            };

            return (
              <View key={threadEmail._id}>
                {!isExpanded ? (
                  <TouchableOpacity
                    style={styles.collapsedEmail}
                    onPress={() => toggleExpanded(threadEmail._id)}
                  >
                    <View style={styles.collapsedEmailContent}>
                      <Text style={styles.collapsedSender} numberOfLines={1}>
                        {threadEmail.direction === "outgoing"
                          ? `To: ${(threadEmail as any).toContacts?.[0]?.name || (threadEmail as any).toContacts?.[0]?.email || "Unknown"}`
                          : threadEmail.fromName || threadEmail.fromContact?.name || threadEmail.fromContact?.email || "Unknown"}
                      </Text>
                      <Text style={styles.collapsedPreview} numberOfLines={1}>
                        {threadEmail.bodyPreview}
                      </Text>
                    </View>
                    <Text style={styles.collapsedTime}>
                      {formatDate(threadEmail.receivedAt)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={isCurrentEmail ? styles.currentEmailHighlight : undefined}>
                    <EmailCard
                      email={emailData}
                      onContactPress={handleContactPress}
                      onUseReply={isLastEmail ? handleReply : undefined}
                      onAddToCalendar={handleAddToCalendar}
                      onSelectMeetingTime={handleSelectMeetingTime}
                      meetingAvailability={isCurrentEmail ? meetingAvailability : undefined}
                      isAddingToCalendar={isAddingToCalendar}
                      showFullContent
                    />
                  </View>
                )}
                {index < threadEmails.length - 1 && <View style={styles.threadDivider} />}
              </View>
            );
          })
        ) : (
          <>
            <EmailCard
              email={displayEmail}
              onContactPress={handleContactPress}
              onUseReply={handleReply}
              onAddToCalendar={handleAddToCalendar}
              onSelectMeetingTime={handleSelectMeetingTime}
              meetingAvailability={meetingAvailability}
              isAddingToCalendar={isAddingToCalendar}
              showFullContent
            />
          </>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleReply}>
          <Text style={styles.actionIcon}>↩️</Text>
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleArchive}
        >
          <Text style={styles.actionIcon}>✓</Text>
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (convexId) markReplyNeeded(convexId);
          }}
        >
          <Text style={styles.actionIcon}>⏰</Text>
          <Text style={styles.actionText}>Remind</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  headerButtonGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: "#6366F1",
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  actionTextPrimary: {
    color: "#fff",
  },
  // Thread styles
  threadHeader: {
    backgroundColor: "#F8F9FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAFF",
  },
  threadHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366F1",
  },
  threadDivider: {
    height: 1,
    backgroundColor: "#eee",
    marginHorizontal: 16,
  },
  collapsedEmail: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
  },
  collapsedEmailContent: {
    flex: 1,
    marginRight: 8,
  },
  collapsedSender: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  collapsedPreview: {
    fontSize: 13,
    color: "#666",
  },
  collapsedTime: {
    fontSize: 12,
    color: "#999",
  },
  currentEmailHighlight: {
    backgroundColor: "#F8F9FF",
  },
});
