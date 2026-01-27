/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: {
  attachments: {
    downloadAttachment: FunctionReference<
      "action",
      "public",
      {
        attachmentDbId: Id<"attachments">;
        emailId: Id<"emails">;
        userEmail: string;
      },
      any
    >;
    generateUploadUrl: FunctionReference<"mutation", "public", {}, any>;
    getEmailAttachments: FunctionReference<
      "query",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
  };
  auth: {
    authenticate: FunctionReference<"action", "public", { code: string }, any>;
    getAuthUrl: FunctionReference<
      "query",
      "public",
      { redirectUri: string },
      any
    >;
    getUser: FunctionReference<"query", "public", { email: string }, any>;
    hasGmailAccess: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    refreshToken: FunctionReference<
      "action",
      "public",
      { refreshToken: string },
      any
    >;
    upsertUser: FunctionReference<
      "mutation",
      "public",
      {
        avatarUrl?: string;
        email: string;
        googleAccessToken?: string;
        googleRefreshToken?: string;
        name?: string;
        workosRefreshToken?: string;
        workosUserId: string;
      },
      any
    >;
  };
  browserAgent: {
    continueBrowserChat: FunctionReference<
      "action",
      "public",
      {
        message: string;
        pageContent?: string;
        pageTitle?: string;
        pageUrl?: string;
        threadId: string;
      },
      any
    >;
    startBrowserChat: FunctionReference<
      "action",
      "public",
      {
        message: string;
        pageContent?: string;
        pageTitle?: string;
        pageUrl?: string;
      },
      any
    >;
  };
  calendar: {
    addToCalendar: FunctionReference<
      "action",
      "public",
      {
        description?: string;
        emailId?: Id<"emails">;
        endTime?: string;
        location?: string;
        recurrence?: string;
        startTime?: string;
        timezone: string;
        title: string;
        userEmail: string;
      },
      any
    >;
    batchAddToCalendar: FunctionReference<
      "action",
      "public",
      { emailIds: Array<Id<"emails">>; timezone: string; userEmail: string },
      any
    >;
    checkExistingCalendarEvents: FunctionReference<
      "action",
      "public",
      {
        startTime?: string;
        timezone: string;
        title: string;
        userEmail: string;
      },
      any
    >;
    checkMeetingAvailability: FunctionReference<
      "action",
      "public",
      {
        proposedTimes: Array<{ endTime: string; startTime: string }>;
        userEmail: string;
      },
      any
    >;
  };
  changelog: {
    getAllChangelogs: FunctionReference<"query", "public", {}, any>;
    getChangelogsSince: FunctionReference<
      "query",
      "public",
      { since?: number },
      any
    >;
    getLastOpened: FunctionReference<"query", "public", {}, any>;
    updateLastOpened: FunctionReference<
      "mutation",
      "public",
      { timezone?: string },
      any
    >;
  };
  chatHistory: {
    deleteThread: FunctionReference<
      "action",
      "public",
      { threadId: string },
      any
    >;
    getThreadMessages: FunctionReference<
      "action",
      "public",
      { threadId: string },
      any
    >;
    listThreads: FunctionReference<"action", "public", {}, any>;
  };
  contacts: {
    addCommitment: FunctionReference<
      "mutation",
      "public",
      {
        contactId: Id<"contacts">;
        direction: "from_contact" | "to_contact";
        source: "manual" | "ai";
        sourceEmailId?: Id<"emails">;
        text: string;
      },
      any
    >;
    addFact: FunctionReference<
      "mutation",
      "public",
      {
        contactId: Id<"contacts">;
        source: "manual" | "ai";
        sourceEmailId?: Id<"emails">;
        text: string;
      },
      any
    >;
    deleteCommitment: FunctionReference<
      "mutation",
      "public",
      { commitmentId: string; contactId: Id<"contacts"> },
      any
    >;
    deleteFact: FunctionReference<
      "mutation",
      "public",
      { contactId: Id<"contacts">; factId: string },
      any
    >;
    getMyContact: FunctionReference<
      "query",
      "public",
      { contactId: Id<"contacts"> },
      any
    >;
    getMyContactByEmail: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    getMyContacts: FunctionReference<
      "query",
      "public",
      { limit?: number },
      any
    >;
    getMyContactStats: FunctionReference<
      "query",
      "public",
      { contactId: Id<"contacts"> },
      any
    >;
    getMyContactStatsByEmail: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    getMyVIPContacts: FunctionReference<"query", "public", {}, any>;
    searchMyContacts: FunctionReference<
      "query",
      "public",
      { limit?: number; query: string },
      any
    >;
    updateCommitment: FunctionReference<
      "mutation",
      "public",
      { commitmentId: string; contactId: Id<"contacts">; text: string },
      any
    >;
    updateCommitmentStatus: FunctionReference<
      "mutation",
      "public",
      {
        commitmentId: string;
        contactId: Id<"contacts">;
        status: "pending" | "completed";
      },
      any
    >;
    updateFact: FunctionReference<
      "mutation",
      "public",
      { contactId: Id<"contacts">; factId: string; text: string },
      any
    >;
    updateMyContactRelationship: FunctionReference<
      "mutation",
      "public",
      {
        contactId: Id<"contacts">;
        relationship: "vip" | "regular" | "unknown";
      },
      any
    >;
    updateMyContactRelationshipSummary: FunctionReference<
      "mutation",
      "public",
      { contactId: Id<"contacts">; relationshipSummary: string },
      any
    >;
    upsertContact: FunctionReference<
      "mutation",
      "public",
      { avatarUrl?: string; email: string; name?: string; userId: Id<"users"> },
      any
    >;
  };
  costs: {
    getAICostByMessageId: FunctionReference<
      "query",
      "public",
      { messageId: string },
      any
    >;
    getAICostsByThread: FunctionReference<
      "query",
      "public",
      { threadId: string },
      any
    >;
    getAICostsByUser: FunctionReference<
      "query",
      "public",
      { userId: string },
      any
    >;
    getAllPricing: FunctionReference<"query", "public", {}, any>;
    getAllToolPricing: FunctionReference<"query", "public", {}, any>;
    getMarkupMultiplier: FunctionReference<
      "query",
      "public",
      { modelId?: string; providerId: string; toolId?: string },
      any
    >;
    getMarkupMultiplierById: FunctionReference<
      "query",
      "public",
      { markupMultiplierId: Id<"markupMultiplier"> },
      any
    >;
    getMyTotalCosts: FunctionReference<"query", "public", {}, any>;
    getPricingByProvider: FunctionReference<
      "query",
      "public",
      { providerId: string },
      any
    >;
    getToolCostsByThread: FunctionReference<
      "query",
      "public",
      { threadId: string },
      any
    >;
    getToolCostsByUser: FunctionReference<
      "query",
      "public",
      { userId: string },
      any
    >;
    getToolPricingByProvider: FunctionReference<
      "query",
      "public",
      { providerId: string },
      any
    >;
    getTotalAICostsByThread: FunctionReference<
      "query",
      "public",
      { threadId: string },
      any
    >;
    getTotalAICostsByUser: FunctionReference<
      "query",
      "public",
      { userId: string },
      any
    >;
    getTotalToolCostsByThread: FunctionReference<
      "query",
      "public",
      { threadId: string },
      any
    >;
    getTotalToolCostsByUser: FunctionReference<
      "query",
      "public",
      { userId: string },
      any
    >;
    searchPricingByModelName: FunctionReference<
      "query",
      "public",
      { searchTerm: string },
      any
    >;
    updatePricingData: FunctionReference<
      "action",
      "public",
      { envKeys?: Record<string, string> },
      any
    >;
  };
  emailAgent: {
    continueChat: FunctionReference<
      "action",
      "public",
      { message: string; threadId: string },
      any
    >;
    searchEmailsForUI: FunctionReference<
      "action",
      "public",
      { query: string },
      any
    >;
    startChat: FunctionReference<"action", "public", { message: string }, any>;
  };
  emails: {
    batchTriageMyEmails: FunctionReference<
      "mutation",
      "public",
      {
        triageActions: Array<{
          action: "done" | "reply_needed";
          emailId: Id<"emails">;
        }>;
      },
      any
    >;
    batchUntriagedMyEmails: FunctionReference<
      "mutation",
      "public",
      { emailIds: Array<Id<"emails">> },
      any
    >;
    downloadAttachment: FunctionReference<
      "action",
      "public",
      { attachmentId: string; emailId: Id<"emails">; userEmail: string },
      any
    >;
    getEmailAttachments: FunctionReference<
      "query",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    getMyAllEmailsDebug: FunctionReference<
      "query",
      "public",
      { cursor?: string; limit?: number },
      any
    >;
    getMyBatchTriagePreview: FunctionReference<
      "query",
      "public",
      { limit?: number; sessionStart?: number },
      any
    >;
    getMyEmail: FunctionReference<
      "query",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    getMyEmailBody: FunctionReference<
      "query",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    getMyThreadEmails: FunctionReference<
      "query",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    getMyTodoEmails: FunctionReference<
      "query",
      "public",
      { limit?: number },
      any
    >;
    getMyUntriagedEmails: FunctionReference<
      "query",
      "public",
      { limit?: number; sessionStart?: number },
      any
    >;
    markMyEmailAsRead: FunctionReference<
      "mutation",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    resetMyTriagedEmails: FunctionReference<"mutation", "public", {}, any>;
    searchMyEmails: FunctionReference<
      "query",
      "public",
      { limit?: number; searchQuery: string },
      any
    >;
    storeEmail: FunctionReference<
      "mutation",
      "public",
      {
        bodyFull: string;
        bodyPreview: string;
        cc?: Array<Id<"contacts">>;
        externalId: string;
        from: Id<"contacts">;
        provider: "gmail" | "outlook" | "imap";
        receivedAt: number;
        subject: string;
        to: Array<Id<"contacts">>;
        userId: Id<"users">;
      },
      any
    >;
    togglePuntEmail: FunctionReference<
      "mutation",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    triageMyEmail: FunctionReference<
      "mutation",
      "public",
      { action: "done" | "reply_needed" | "delegated"; emailId: Id<"emails"> },
      any
    >;
    triageMyEmailsFromSender: FunctionReference<
      "mutation",
      "public",
      { senderEmail: string },
      any
    >;
    untriagedMyEmail: FunctionReference<
      "mutation",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
  };
  featureRequests: {
    addClarification: FunctionReference<
      "mutation",
      "public",
      { clarificationText: string; id: Id<"featureRequests"> },
      any
    >;
    cancel: FunctionReference<
      "mutation",
      "public",
      { id: Id<"featureRequests"> },
      any
    >;
    generateUploadUrl: FunctionReference<"mutation", "public", {}, any>;
    getMine: FunctionReference<"query", "public", {}, any>;
    getPending: FunctionReference<"query", "public", {}, any>;
    markCombined: FunctionReference<
      "mutation",
      "public",
      { combinedIntoId: Id<"featureRequests">; id: Id<"featureRequests"> },
      any
    >;
    markCompleted: FunctionReference<
      "mutation",
      "public",
      {
        branchName?: string;
        commitHash?: string;
        easDashboardUrl?: string;
        easUpdateId?: string;
        easUpdateMessage?: string;
        id: Id<"featureRequests">;
      },
      any
    >;
    markFailed: FunctionReference<
      "mutation",
      "public",
      { error: string; id: Id<"featureRequests"> },
      any
    >;
    markProcessing: FunctionReference<
      "mutation",
      "public",
      { id: Id<"featureRequests"> },
      any
    >;
    requestRevert: FunctionReference<
      "mutation",
      "public",
      { id: Id<"featureRequests"> },
      any
    >;
    retryFailed: FunctionReference<"mutation", "public", {}, any>;
    retryOne: FunctionReference<
      "mutation",
      "public",
      { id: Id<"featureRequests"> },
      any
    >;
    submit: FunctionReference<
      "mutation",
      "public",
      {
        debugLogs?: string;
        screenshotAnnotations?: string;
        screenshotStorageId?: Id<"_storage">;
        transcript: string;
      },
      any
    >;
    updateClaudeOutput: FunctionReference<
      "mutation",
      "public",
      {
        claudeOutput: string;
        claudeSuccess: boolean;
        id: Id<"featureRequests">;
      },
      any
    >;
    updateProgress: FunctionReference<
      "mutation",
      "public",
      {
        branchName?: string;
        commitHash?: string;
        id: Id<"featureRequests">;
        progressMessage: string;
        progressStep:
          | "cloning"
          | "implementing"
          | "pushing"
          | "merging"
          | "deploying_backend"
          | "uploading"
          | "ready";
      },
      any
    >;
    updateTranscript: FunctionReference<
      "mutation",
      "public",
      { id: Id<"featureRequests">; transcript: string },
      any
    >;
  };
  gmailAccountAuth: {
    getGmailAuthUrl: FunctionReference<
      "query",
      "public",
      { redirectUri: string },
      any
    >;
    hasGmailAccounts: FunctionReference<"query", "public", {}, any>;
    linkGmailAccount: FunctionReference<
      "action",
      "public",
      { code: string; redirectUri: string },
      any
    >;
    listGmailAccounts: FunctionReference<"query", "public", {}, any>;
    removeGmailAccount: FunctionReference<
      "mutation",
      "public",
      { accountId: Id<"gmailAccounts"> },
      any
    >;
    setPrimaryAccount: FunctionReference<
      "mutation",
      "public",
      { accountId: Id<"gmailAccounts"> },
      any
    >;
    storeGmailAccount: FunctionReference<
      "mutation",
      "public",
      {
        accessToken: string;
        authSource?: "workos" | "gmail_oauth";
        avatarUrl?: string;
        displayName?: string;
        email: string;
        expiresIn: number;
        refreshToken?: string;
        workosRefreshToken?: string;
      },
      any
    >;
  };
  gmailAccounts: {
    getGmailAccountByEmail: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    getMyGmailAccounts: FunctionReference<"query", "public", {}, any>;
  };
  gmailAuth: {
    exchangeCodeForTokens: FunctionReference<
      "action",
      "public",
      { code: string; redirectUri: string },
      any
    >;
    getGmailAuthUrl: FunctionReference<
      "query",
      "public",
      { redirectUri: string },
      any
    >;
    hasGmailConnected: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    storeGmailTokens: FunctionReference<
      "mutation",
      "public",
      {
        accessToken: string;
        email: string;
        expiresAt: number;
        refreshToken: string;
      },
      any
    >;
  };
  gmailOAuth: {
    exchangeCode: FunctionReference<
      "action",
      "public",
      { code: string; redirectUri: string },
      any
    >;
    getGmailAuthUrl: FunctionReference<
      "query",
      "public",
      { redirectUri: string },
      any
    >;
    hasGmailConnected: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    storeGmailTokens: FunctionReference<
      "mutation",
      "public",
      {
        accessToken: string;
        email: string;
        expiresAt: number;
        refreshToken: string;
      },
      any
    >;
  };
  gmailSend: {
    sendEmail: FunctionReference<
      "action",
      "public",
      {
        attachments?: Array<{
          filename: string;
          mimeType: string;
          storageId: Id<"_storage">;
        }>;
        body: string;
        replyToMessageId?: string;
        subject: string;
        to: string;
        userEmail: string;
      },
      any
    >;
    sendReply: FunctionReference<
      "action",
      "public",
      {
        body: string;
        inReplyTo?: string;
        subject: string;
        to: string;
        userEmail: string;
      },
      any
    >;
  };
  gmailSync: {
    downloadAttachment: FunctionReference<
      "action",
      "public",
      { attachmentId: string; emailId: Id<"emails">; userEmail: string },
      any
    >;
    fetchEmailBody: FunctionReference<
      "action",
      "public",
      { emailId: Id<"emails">; userEmail: string },
      any
    >;
    fetchEmails: FunctionReference<
      "action",
      "public",
      { maxResults?: number; pageToken?: string; userEmail: string },
      any
    >;
    getEmailAttachments: FunctionReference<
      "query",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
  };
  imapAuth: {
    listImapAccounts: FunctionReference<"mutation", "public", {}, any>;
    removeImapAccount: FunctionReference<
      "mutation",
      "public",
      { email: string },
      any
    >;
    storeImapCredentials: FunctionReference<
      "mutation",
      "public",
      {
        email: string;
        host: string;
        password: string;
        port: number;
        tls?: boolean;
      },
      any
    >;
  };
  imapAuthActions: {
    testImapConnection: FunctionReference<
      "action",
      "public",
      {
        email: string;
        host: string;
        password: string;
        port: number;
        tls?: boolean;
      },
      any
    >;
  };
  missedTodos: {
    startMissedTodosSearchByEmail: FunctionReference<
      "mutation",
      "public",
      { email: string },
      any
    >;
  };
  notifications: {
    registerMyPushToken: FunctionReference<
      "mutation",
      "public",
      { pushToken: string },
      any
    >;
    sendMyTestCommunicationNotification: FunctionReference<
      "mutation",
      "public",
      { testContactEmail?: string },
      any
    >;
    sendMyTestNotificationWithAvatar: FunctionReference<
      "mutation",
      "public",
      { testContactEmail?: string },
      any
    >;
    sendTestNotificationForRecentEmail: FunctionReference<
      "mutation",
      "public",
      {},
      any
    >;
  };
  shortcuts: {
    ping: FunctionReference<"action", "public", {}, any>;
    processText: FunctionReference<"action", "public", { text: string }, any>;
  };
  staticHosting: {
    getCurrentDeployment: FunctionReference<"query", "public", {}, any>;
  };
  subscriptions: {
    batchUnsubscribeMy: FunctionReference<
      "action",
      "public",
      { subscriptionIds: Array<Id<"subscriptions">> },
      any
    >;
    forceMyRescan: FunctionReference<"action", "public", {}, any>;
    scanMyExistingEmails: FunctionReference<"action", "public", {}, any>;
  };
  subscriptionsHelpers: {
    getSubscriptions: FunctionReference<
      "query",
      "public",
      { userEmail: string },
      any
    >;
  };
  summarize: {
    clearWritingStyles: FunctionReference<
      "mutation",
      "public",
      { userEmail: string },
      any
    >;
    getTopRecipients: FunctionReference<
      "query",
      "public",
      { limit?: number; userEmail: string },
      any
    >;
  };
  summarizeActions: {
    backfillWritingStyles: FunctionReference<
      "action",
      "public",
      { userEmail: string },
      any
    >;
    reprocessEmail: FunctionReference<
      "action",
      "public",
      { emailId: Id<"emails">; userEmail: string },
      any
    >;
    resetAndResummarizeAll: FunctionReference<
      "action",
      "public",
      { userEmail: string },
      any
    >;
    retryUnprocessedEmails: FunctionReference<
      "action",
      "public",
      { userEmail: string },
      any
    >;
    summarizeEmail: FunctionReference<
      "action",
      "public",
      { emailId: Id<"emails"> },
      any
    >;
    summarizeEmailsByExternalIds: FunctionReference<
      "action",
      "public",
      { externalIds: Array<string>; userEmail: string },
      any
    >;
  };
  sync: {
    backfillAvatarUrls: FunctionReference<"mutation", "public", {}, any>;
    getPendingForProcessing: FunctionReference<
      "query",
      "public",
      { limit?: number },
      any
    >;
    markCompleted: FunctionReference<
      "mutation",
      "public",
      { queueId: Id<"aiProcessingQueue"> },
      any
    >;
    markFailed: FunctionReference<
      "mutation",
      "public",
      { error: string; queueId: Id<"aiProcessingQueue"> },
      any
    >;
    markProcessing: FunctionReference<
      "mutation",
      "public",
      { queueId: Id<"aiProcessingQueue"> },
      any
    >;
    processIncomingEmail: FunctionReference<
      "action",
      "public",
      {
        rawEmail: {
          bodyFull: string;
          bodyPreview: string;
          cc?: Array<{ email: string; name?: string }>;
          from: { email: string; name?: string };
          id: string;
          receivedAt: number;
          subject: string;
          threadId: string;
          to: Array<{ email: string; name?: string }>;
        };
        userId: Id<"users">;
      },
      any
    >;
  };
  users: {
    connectGmailAccount: FunctionReference<
      "mutation",
      "public",
      {
        accessToken: string;
        email: string;
        expiresAt: number;
        refreshToken: string;
        userId: Id<"users">;
      },
      any
    >;
    disconnectMyProvider: FunctionReference<
      "mutation",
      "public",
      { provider: "gmail" | "outlook" | "imap" },
      any
    >;
    getMe: FunctionReference<"query", "public", {}, any>;
    getMyConnectedProviders: FunctionReference<"query", "public", {}, any>;
    updateMyPreferences: FunctionReference<
      "mutation",
      "public",
      {
        preferences: { autoProcessEmails?: boolean; urgencyThreshold?: number };
      },
      any
    >;
    upsertFromWorkOS: FunctionReference<
      "mutation",
      "public",
      { avatarUrl?: string; email: string; name?: string; workosId: string },
      any
    >;
  };
  voice: {
    getDeepgramKey: FunctionReference<"action", "public", {}, any>;
  };
  workosAuth: {
    getOAuthTokens: FunctionReference<
      "action",
      "public",
      { workosUserId: string },
      any
    >;
    storeTokens: FunctionReference<
      "mutation",
      "public",
      {
        accessToken: string;
        email: string;
        refreshToken?: string;
        workosUserId: string;
      },
      any
    >;
    syncOAuthTokens: FunctionReference<
      "action",
      "public",
      { email: string; workosUserId: string },
      any
    >;
  };
};

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: {
  attachments: {
    getAttachmentById: FunctionReference<
      "mutation",
      "internal",
      { attachmentDbId: Id<"attachments"> },
      any
    >;
  };
  auth: {
    getUserIdByWorkosId: FunctionReference<
      "query",
      "internal",
      { workosUserId: string },
      any
    >;
    updateWorkosRefreshToken: FunctionReference<
      "mutation",
      "internal",
      { userId: Id<"users">; workosRefreshToken: string },
      any
    >;
  };
  changelog: {
    addChangelog: FunctionReference<
      "mutation",
      "internal",
      {
        description: string;
        publishedAt?: number;
        title: string;
        type: "feature" | "improvement" | "bugfix" | "other";
        version: string;
      },
      any
    >;
  };
  costs: {
    refreshPricingData: FunctionReference<"action", "internal", {}, any>;
  };
  emailAgent: {
    backfillEmbeddings: FunctionReference<
      "action",
      "internal",
      { batchSize?: number; userId: Id<"users"> },
      any
    >;
  };
  emailEmbeddings: {
    backfillEmbeddings: FunctionReference<
      "action",
      "internal",
      { batchSize?: number; userId: Id<"users"> },
      any
    >;
    generateEmbedding: FunctionReference<
      "action",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    searchSimilarEmails: FunctionReference<
      "action",
      "internal",
      { limit?: number; query: string; userId: Id<"users"> },
      any
    >;
  };
  emailEmbeddingsHelpers: {
    getContactById: FunctionReference<
      "query",
      "internal",
      { contactId: Id<"contacts"> },
      any
    >;
    getEmailById: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getEmailsNeedingEmbeddings: FunctionReference<
      "query",
      "internal",
      { limit: number; userId: Id<"users"> },
      any
    >;
    getEmailWithBody: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getSummaryById: FunctionReference<
      "query",
      "internal",
      { summaryId: Id<"emailSummaries"> },
      any
    >;
    saveEmbedding: FunctionReference<
      "mutation",
      "internal",
      { emailId: Id<"emails">; embedding: Array<number> },
      any
    >;
  };
  emails: {
    debugFindEmailsBySender: FunctionReference<
      "query",
      "internal",
      { limit?: number; senderEmail: string },
      any
    >;
    getEmailBodyById: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getEmailById: FunctionReference<
      "query",
      "internal",
      { emailId: string },
      any
    >;
  };
  emailSync: {
    checkNewEmailsForAllUsers: FunctionReference<"action", "internal", {}, any>;
    debugUserTokens: FunctionReference<"action", "internal", {}, any>;
  };
  emailSyncHelpers: {
    checkEmailExists: FunctionReference<
      "query",
      "internal",
      { externalId: string },
      any
    >;
    decryptUserTokens: FunctionReference<
      "mutation",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getAllUsersDebug: FunctionReference<"query", "internal", {}, any>;
    getUsersWithGmail: FunctionReference<"query", "internal", {}, any>;
    updateLastSync: FunctionReference<
      "mutation",
      "internal",
      { timestamp: number; userId: Id<"users"> },
      any
    >;
    updateUserGmailTokens: FunctionReference<
      "mutation",
      "internal",
      {
        gmailAccessToken: string;
        gmailTokenExpiresAt: number;
        userId: Id<"users">;
      },
      any
    >;
    updateUserTokensWithWorkOS: FunctionReference<
      "mutation",
      "internal",
      {
        gmailAccessToken: string;
        gmailTokenExpiresAt: number;
        userId: Id<"users">;
        workosRefreshToken: string;
      },
      any
    >;
  };
  emailWorkflow: {
    processNewEmails: FunctionReference<"mutation", "internal", any, any>;
    startEmailProcessing: FunctionReference<
      "mutation",
      "internal",
      {
        externalIds: Array<string>;
        gmailAccountId?: Id<"gmailAccounts">;
        userEmail: string;
        userId: Id<"users">;
      },
      any
    >;
  };
  emailWorkflowHelpers: {
    filterOutSubscriptions: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string> },
      any
    >;
    getMostUrgentEmailDetails: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string>; threshold: number },
      any
    >;
    getVIPContactEmails: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string> },
      any
    >;
    getVIPEmailDetails: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string> },
      any
    >;
  };
  featureRequests: {
    debugListRecent: FunctionReference<
      "query",
      "internal",
      { limit?: number },
      any
    >;
    resetToPending: FunctionReference<
      "mutation",
      "internal",
      { id: Id<"featureRequests"> },
      any
    >;
    sendFeatureCompletedNotification: FunctionReference<
      "mutation",
      "internal",
      { transcript: string; userId: Id<"users"> },
      any
    >;
    sendFeatureFailedNotification: FunctionReference<
      "mutation",
      "internal",
      { error: string; transcript: string; userId: Id<"users"> },
      any
    >;
  };
  gmailAccountAuth: {
    storeGmailAccountFromWorkos: FunctionReference<
      "mutation",
      "internal",
      {
        accessToken: string;
        avatarUrl?: string;
        displayName?: string;
        email: string;
        expiresIn: number;
        refreshToken?: string;
        userId: Id<"users">;
        workosRefreshToken?: string;
      },
      any
    >;
    storeGmailAccountInternal: FunctionReference<
      "mutation",
      "internal",
      {
        accessToken: string;
        avatarUrl?: string;
        displayName?: string;
        email: string;
        expiresIn: number;
        refreshToken?: string;
        userId: Id<"users">;
      },
      any
    >;
  };
  gmailAccountHelpers: {
    debugGmailAccountTokens: FunctionReference<"query", "internal", {}, any>;
    decryptGmailAccountTokens: FunctionReference<
      "mutation",
      "internal",
      { accountId: Id<"gmailAccounts"> },
      any
    >;
    getGmailAccountByEmail: FunctionReference<
      "query",
      "internal",
      { userEmail: string },
      any
    >;
    getGmailAccountsForSync: FunctionReference<"query", "internal", {}, any>;
    getUserIdFromAccount: FunctionReference<
      "query",
      "internal",
      { accountId: Id<"gmailAccounts"> },
      any
    >;
    updateGmailAccountAuthSource: FunctionReference<
      "mutation",
      "internal",
      { accountId: Id<"gmailAccounts">; authSource: "workos" | "gmail_oauth" },
      any
    >;
    updateGmailAccountLastSync: FunctionReference<
      "mutation",
      "internal",
      { accountId: Id<"gmailAccounts">; timestamp: number },
      any
    >;
    updateGmailAccountTokens: FunctionReference<
      "mutation",
      "internal",
      {
        accessToken: string;
        accountId: Id<"gmailAccounts">;
        refreshToken?: string;
        tokenExpiresAt: number;
      },
      any
    >;
    updateGmailAccountWorkOSTokens: FunctionReference<
      "mutation",
      "internal",
      {
        accessToken: string;
        accountId: Id<"gmailAccounts">;
        tokenExpiresAt: number;
        workosRefreshToken?: string;
      },
      any
    >;
  };
  gmailAuth: {
    updateUserTokens: FunctionReference<
      "mutation",
      "internal",
      { accessToken: string; expiresAt: number; userId: Id<"users"> },
      any
    >;
  };
  gmailQueries: {
    getCachedEmails: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string>; userId?: Id<"users"> },
      any
    >;
    getCachedSummaries: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string>; userId?: Id<"users"> },
      any
    >;
    getUserByEmail: FunctionReference<
      "query",
      "internal",
      { email: string },
      any
    >;
  };
  gmailSync: {
    debugFetchRawEmail: FunctionReference<
      "action",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    fetchAndStoreEmailsByIds: FunctionReference<
      "action",
      "internal",
      {
        gmailAccountId?: Id<"gmailAccounts">;
        messageIds: Array<string>;
        userEmail: string;
      },
      any
    >;
    getCachedEmails: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string>; userId?: Id<"users"> },
      any
    >;
    getCachedSummaries: FunctionReference<
      "query",
      "internal",
      { externalIds: Array<string>; userId?: Id<"users"> },
      any
    >;
    getEmailForSync: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getUserByEmail: FunctionReference<
      "query",
      "internal",
      { email: string },
      any
    >;
    refetchEmailBody: FunctionReference<
      "action",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    refetchUpdateEmailBody: FunctionReference<
      "mutation",
      "internal",
      { bodyFull: string; emailId: Id<"emails"> },
      any
    >;
    storeAttachment: FunctionReference<
      "mutation",
      "internal",
      {
        attachmentId: string;
        contentId?: string;
        emailId: Id<"emails">;
        filename: string;
        mimeType: string;
        size: number;
        storageId?: Id<"_storage">;
        userId: Id<"users">;
      },
      any
    >;
    storeEmailInternal: FunctionReference<
      "mutation",
      "internal",
      {
        bodyFull: string;
        bodyPreview: string;
        direction?: "incoming" | "outgoing";
        externalId: string;
        from: Id<"contacts">;
        gmailAccountId?: Id<"gmailAccounts">;
        isRead: boolean;
        isSubscription?: boolean;
        listUnsubscribe?: string;
        listUnsubscribePost?: boolean;
        provider: "gmail" | "outlook" | "imap";
        receivedAt: number;
        subject: string;
        threadId?: string;
        to: Array<Id<"contacts">>;
        userId: Id<"users">;
      },
      any
    >;
    updateEmailBody: FunctionReference<
      "mutation",
      "internal",
      { bodyFull: string; emailId: Id<"emails"> },
      any
    >;
    updateUserTokens: FunctionReference<
      "mutation",
      "internal",
      { accessToken: string; expiresAt: number; userId: Id<"users"> },
      any
    >;
    upsertContact: FunctionReference<
      "mutation",
      "internal",
      {
        avatarStorageId?: Id<"_storage">;
        email: string;
        name?: string;
        userId: Id<"users">;
      },
      any
    >;
  };
  imapAuth: {
    updateConnectedProviders: FunctionReference<
      "mutation",
      "internal",
      { connectedProviders: any; userId: Id<"users"> },
      any
    >;
  };
  imapSync: {
    syncImapForUser: FunctionReference<
      "action",
      "internal",
      { providerEmail: string; userEmail: string; userId: Id<"users"> },
      any
    >;
  };
  migrations: {
    encryptExistingPii: {
      encryptContacts: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      encryptEmailBodies: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      encryptEmails: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      encryptEmailSummaries: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      encryptFeatureRequests: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      encryptSubscriptions: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      encryptUsers: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      run: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
    };
    migrateEmailBodies: FunctionReference<
      "mutation",
      "internal",
      {
        batchSize?: number;
        cursor?: string | null;
        dryRun?: boolean;
        fn?: string;
        next?: Array<string>;
      },
      any
    >;
    populateAuthSource: {
      migrateUserTokensToGmailAccounts: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      populateGmailAccountAuthSource: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
      run: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun?: boolean;
          fn?: string;
          next?: Array<string>;
        },
        any
      >;
    };
    run: FunctionReference<
      "mutation",
      "internal",
      {
        batchSize?: number;
        cursor?: string | null;
        dryRun?: boolean;
        fn?: string;
        next?: Array<string>;
      },
      any
    >;
    runEmailBodiesMigration: FunctionReference<
      "mutation",
      "internal",
      {
        batchSize?: number;
        cursor?: string | null;
        dryRun?: boolean;
        fn?: string;
        next?: Array<string>;
      },
      any
    >;
  };
  missedTodos: {
    findMissedTodos: FunctionReference<"mutation", "internal", any, any>;
  };
  missedTodosHelpers: {
    getRecentUntriagedEmails: FunctionReference<
      "query",
      "internal",
      { sinceTimestamp: number; userId: Id<"users"> },
      any
    >;
    getUserByEmail: FunctionReference<
      "query",
      "internal",
      { email: string },
      any
    >;
    hasUserRepliedToThread: FunctionReference<
      "query",
      "internal",
      {
        emailTimestamp: number;
        originalSenderEmail: string;
        threadId: string;
        userEmail: string;
        userId: Id<"users">;
      },
      any
    >;
    markAsReplyNeeded: FunctionReference<
      "mutation",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
  };
  missedTodosWorkflow: {
    analyzeEmailsForMissedTodos: FunctionReference<
      "action",
      "internal",
      {
        emails: Array<{
          bodyPreview: string;
          fromEmail: string;
          fromName?: string;
          id: string;
          subject: string;
        }>;
        userId: Id<"users">;
      },
      any
    >;
  };
  notifications: {
    sendHighPriorityNotification: FunctionReference<
      "mutation",
      "internal",
      {
        highPriorityCount: number;
        mostUrgentEmailId?: Id<"emails">;
        mostUrgentSender?: string;
        mostUrgentSenderAvatar?: string;
        mostUrgentSubject?: string;
        totalCount: number;
        urgencyScore: number;
        userId: Id<"users">;
      },
      any
    >;
    sendMissedTodosNotification: FunctionReference<
      "mutation",
      "internal",
      { foundCount: number; userId: Id<"users"> },
      any
    >;
    sendNewEmailNotification: FunctionReference<
      "mutation",
      "internal",
      {
        emailCount: number;
        senderName?: string;
        subject?: string;
        userId: Id<"users">;
      },
      any
    >;
    sendVIPContactNotification: FunctionReference<
      "mutation",
      "internal",
      {
        emailId?: Id<"emails">;
        senderAvatarUrl?: string;
        senderName?: string;
        subject?: string;
        userId: Id<"users">;
      },
      any
    >;
  };
  reminders: {
    checkAndSendReminders: FunctionReference<"mutation", "internal", {}, any>;
    getStaleReplyNeededEmails: FunctionReference<"query", "internal", {}, any>;
    getUpcomingDeadlines: FunctionReference<"query", "internal", {}, any>;
    markDeadlineReminderSent: FunctionReference<
      "mutation",
      "internal",
      { summaryId: Id<"emailSummaries"> },
      any
    >;
    markReminderSent: FunctionReference<
      "mutation",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    sendDeadlineReminder: FunctionReference<
      "mutation",
      "internal",
      {
        deadline: string;
        deadlineDescription: string;
        subject: string;
        userId: Id<"users">;
      },
      any
    >;
    sendStaleReplyReminder: FunctionReference<
      "mutation",
      "internal",
      { senderName: string; subject: string; userId: Id<"users"> },
      any
    >;
  };
  seedChangelogs: {
    seed: FunctionReference<"mutation", "internal", {}, any>;
  };
  staticHosting: {
    gcOldAssets: FunctionReference<
      "mutation",
      "internal",
      { currentDeploymentId: string },
      any
    >;
    generateUploadUrl: FunctionReference<"mutation", "internal", {}, any>;
    listAssets: FunctionReference<"query", "internal", { limit?: number }, any>;
    recordAsset: FunctionReference<
      "mutation",
      "internal",
      {
        contentType: string;
        deploymentId: string;
        path: string;
        storageId: string;
      },
      any
    >;
  };
  subscriptions: {
    scanExistingEmailsInternal: FunctionReference<
      "action",
      "internal",
      { userEmail: string },
      any
    >;
  };
  subscriptionsHelpers: {
    deleteSubscriptions: FunctionReference<
      "mutation",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getContactById: FunctionReference<
      "query",
      "internal",
      { contactId: Id<"contacts"> },
      any
    >;
    getEmailIdsForReset: FunctionReference<
      "query",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getEmailsWithoutSubscriptionCheck: FunctionReference<
      "query",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getSubscriptionById: FunctionReference<
      "query",
      "internal",
      { subscriptionId: Id<"subscriptions"> },
      any
    >;
    getUserByEmailInternal: FunctionReference<
      "query",
      "internal",
      { email: string },
      any
    >;
    getUserByIdInternal: FunctionReference<
      "query",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getUserByWorkosId: FunctionReference<
      "query",
      "internal",
      { workosId: string },
      any
    >;
    resetEmailSubscriptionFlags: FunctionReference<
      "mutation",
      "internal",
      { emailIds: Array<Id<"emails">> },
      any
    >;
    triageEmailsFromSender: FunctionReference<
      "mutation",
      "internal",
      { senderEmail: string; userId: Id<"users"> },
      any
    >;
    updateEmailSubscriptionHeaders: FunctionReference<
      "mutation",
      "internal",
      {
        emailId: Id<"emails">;
        isSubscription: boolean;
        listUnsubscribe?: string;
        listUnsubscribePost?: boolean;
      },
      any
    >;
    updateStatus: FunctionReference<
      "mutation",
      "internal",
      {
        status:
          | "subscribed"
          | "pending"
          | "processing"
          | "unsubscribed"
          | "failed"
          | "manual_required";
        subscriptionId: Id<"subscriptions">;
        unsubscribedAt?: number;
      },
      any
    >;
    upsertSubscription: FunctionReference<
      "mutation",
      "internal",
      {
        emailId: Id<"emails">;
        listUnsubscribe?: string;
        listUnsubscribePost?: boolean;
        receivedAt: number;
        senderEmail: string;
        senderName?: string;
        subject?: string;
        userId: Id<"users">;
      },
      any
    >;
  };
  summarize: {
    deleteAllSummariesForUser: FunctionReference<
      "mutation",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    deleteSummaryForEmail: FunctionReference<
      "mutation",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getContactsForWritingStyleBackfill: FunctionReference<
      "query",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getEmailBasicInfo: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getEmailByExternalId: FunctionReference<
      "query",
      "internal",
      { externalId: string },
      any
    >;
    getEmailForSummary: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getExternalIdForEmail: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getExternalIdsForUser: FunctionReference<
      "query",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    getSentEmailsToContact: FunctionReference<
      "query",
      "internal",
      { contactId: Id<"contacts">; limit?: number; userId: Id<"users"> },
      any
    >;
    getSummary: FunctionReference<
      "query",
      "internal",
      { emailId: Id<"emails"> },
      any
    >;
    getUnprocessedExternalIdsForUser: FunctionReference<
      "query",
      "internal",
      { userId: Id<"users"> },
      any
    >;
    markCalendarEventAdded: FunctionReference<
      "mutation",
      "internal",
      {
        calendarEventId: string;
        calendarEventLink: string;
        emailId: Id<"emails">;
      },
      any
    >;
    saveAISuggestedCommitments: FunctionReference<
      "mutation",
      "internal",
      {
        commitments: Array<{
          direction: "from_contact" | "to_contact";
          text: string;
        }>;
        contactId: Id<"contacts">;
        emailId: Id<"emails">;
      },
      any
    >;
    saveAISuggestedFacts: FunctionReference<
      "mutation",
      "internal",
      {
        contactId: Id<"contacts">;
        emailId: Id<"emails">;
        facts: Array<string>;
      },
      any
    >;
    updateContactWritingStyle: FunctionReference<
      "mutation",
      "internal",
      {
        contactId: Id<"contacts">;
        writingStyle: {
          analyzedAt: number;
          characteristics?: Array<string>;
          emailsAnalyzed: number;
          greeting?: string;
          samplePhrases?: Array<string>;
          signoff?: string;
          tone: string;
        };
      },
      any
    >;
    updateEmailSummary: FunctionReference<
      "mutation",
      "internal",
      {
        actionDescription?: string;
        actionRequired?: "reply" | "action" | "fyi" | "none";
        actionableItems?: Array<{
          attachmentId?: string;
          label: string;
          type: "link" | "attachment";
          url?: string;
        }>;
        calendarEvent?: {
          description?: string;
          endTime?: string;
          location?: string;
          recurrence?: string;
          recurrenceDescription?: string;
          startTime?: string;
          title: string;
        };
        deadline?: string;
        deadlineDescription?: string;
        emailId: Id<"emails">;
        importantAttachmentIds?: Array<Id<"attachments">>;
        isMarketing?: boolean;
        meetingRequest?: {
          isMeetingRequest: boolean;
          proposedTimes?: Array<{ endTime: string; startTime: string }>;
        };
        quickReplies?: Array<{ body: string; label: string }>;
        shouldAcceptCalendar?: boolean;
        suggestedReply?: string;
        summary: string;
        urgencyReason: string;
        urgencyScore: number;
      },
      any
    >;
  };
  summarizeActions: {
    analyzeWritingStyle: FunctionReference<
      "action",
      "internal",
      { contactId: Id<"contacts">; contactName?: string; userId: Id<"users"> },
      any
    >;
    summarizeByExternalIds: FunctionReference<
      "action",
      "internal",
      { externalIds: Array<string>; userEmail: string },
      any
    >;
  };
  sync: {
    storeEmailInternal: FunctionReference<
      "mutation",
      "internal",
      {
        bodyFull: string;
        bodyPreview: string;
        cc?: Array<Id<"contacts">>;
        externalId: string;
        from: Id<"contacts">;
        provider: "gmail" | "outlook" | "imap";
        receivedAt: number;
        subject: string;
        to: Array<Id<"contacts">>;
        userId: Id<"users">;
      },
      any
    >;
    upsertContactInternal: FunctionReference<
      "mutation",
      "internal",
      { email: string; name?: string; userId: Id<"users"> },
      any
    >;
  };
  users: {
    get: FunctionReference<"query", "internal", { userId: Id<"users"> }, any>;
    getUserForAuth: FunctionReference<
      "query",
      "internal",
      { email?: string; workosId?: string },
      any
    >;
    listAll: FunctionReference<"query", "internal", {}, any>;
  };
};

export declare const components: {
  agent: {
    apiKeys: {
      destroy: FunctionReference<
        "mutation",
        "internal",
        { apiKey?: string; name?: string },
        | "missing"
        | "deleted"
        | "name mismatch"
        | "must provide either apiKey or name"
      >;
      issue: FunctionReference<
        "mutation",
        "internal",
        { name?: string },
        string
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { apiKey: string },
        boolean
      >;
    };
    files: {
      addFile: FunctionReference<
        "mutation",
        "internal",
        {
          filename?: string;
          hash: string;
          mimeType: string;
          storageId: string;
        },
        { fileId: string; storageId: string }
      >;
      copyFile: FunctionReference<
        "mutation",
        "internal",
        { fileId: string },
        null
      >;
      deleteFiles: FunctionReference<
        "mutation",
        "internal",
        { fileIds: Array<string>; force?: boolean },
        Array<string>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { fileId: string },
        null | {
          _creationTime: number;
          _id: string;
          filename?: string;
          hash: string;
          lastTouchedAt: number;
          mimeType: string;
          refcount: number;
          storageId: string;
        }
      >;
      getFilesToDelete: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            filename?: string;
            hash: string;
            lastTouchedAt: number;
            mimeType: string;
            refcount: number;
            storageId: string;
          }>;
        }
      >;
      useExistingFile: FunctionReference<
        "mutation",
        "internal",
        { filename?: string; hash: string },
        null | { fileId: string; storageId: string }
      >;
    };
    messages: {
      addMessages: FunctionReference<
        "mutation",
        "internal",
        {
          agentName?: string;
          embeddings?: {
            dimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
            model: string;
            vectors: Array<Array<number> | null>;
          };
          failPendingSteps?: boolean;
          hideFromUserIdSearch?: boolean;
          messages: Array<{
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            message:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | { type: "text"; value: string }
                              | { type: "json"; value: any }
                              | { type: "error-text"; value: string }
                              | { type: "error-json"; value: any }
                              | {
                                  type: "content";
                                  value: Array<
                                    | { text: string; type: "text" }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<{
                    args?: any;
                    experimental_content?: Array<
                      | { text: string; type: "text" }
                      | { data: string; mimeType?: string; type: "image" }
                    >;
                    isError?: boolean;
                    output?:
                      | { type: "text"; value: string }
                      | { type: "json"; value: any }
                      | { type: "error-text"; value: string }
                      | { type: "error-json"; value: any }
                      | {
                          type: "content";
                          value: Array<
                            | { text: string; type: "text" }
                            | { data: string; mediaType: string; type: "media" }
                          >;
                        };
                    providerExecuted?: boolean;
                    providerMetadata?: Record<string, Record<string, any>>;
                    providerOptions?: Record<string, Record<string, any>>;
                    result?: any;
                    toolCallId: string;
                    toolName: string;
                    type: "tool-result";
                  }>;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status?: "pending" | "success" | "failed";
            text?: string;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
          pendingMessageId?: string;
          promptMessageId?: string;
          threadId: string;
          userId?: string;
        },
        {
          messages: Array<{
            _creationTime: number;
            _id: string;
            agentName?: string;
            embeddingId?: string;
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            id?: string;
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | { type: "text"; value: string }
                              | { type: "json"; value: any }
                              | { type: "error-text"; value: string }
                              | { type: "error-json"; value: any }
                              | {
                                  type: "content";
                                  value: Array<
                                    | { text: string; type: "text" }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<{
                    args?: any;
                    experimental_content?: Array<
                      | { text: string; type: "text" }
                      | { data: string; mimeType?: string; type: "image" }
                    >;
                    isError?: boolean;
                    output?:
                      | { type: "text"; value: string }
                      | { type: "json"; value: any }
                      | { type: "error-text"; value: string }
                      | { type: "error-json"; value: any }
                      | {
                          type: "content";
                          value: Array<
                            | { text: string; type: "text" }
                            | { data: string; mediaType: string; type: "media" }
                          >;
                        };
                    providerExecuted?: boolean;
                    providerMetadata?: Record<string, Record<string, any>>;
                    providerOptions?: Record<string, Record<string, any>>;
                    result?: any;
                    toolCallId: string;
                    toolName: string;
                    type: "tool-result";
                  }>;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            order: number;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            providerOptions?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status: "pending" | "success" | "failed";
            stepOrder: number;
            text?: string;
            threadId: string;
            tool: boolean;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            userId?: string;
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
        }
      >;
      cloneThread: FunctionReference<
        "action",
        "internal",
        {
          batchSize?: number;
          copyUserIdForVectorSearch?: boolean;
          excludeToolMessages?: boolean;
          insertAtOrder?: number;
          limit?: number;
          sourceThreadId: string;
          statuses?: Array<"pending" | "success" | "failed">;
          targetThreadId: string;
          upToAndIncludingMessageId?: string;
        },
        number
      >;
      deleteByIds: FunctionReference<
        "mutation",
        "internal",
        { messageIds: Array<string> },
        Array<string>
      >;
      deleteByOrder: FunctionReference<
        "mutation",
        "internal",
        {
          endOrder: number;
          endStepOrder?: number;
          startOrder: number;
          startStepOrder?: number;
          threadId: string;
        },
        { isDone: boolean; lastOrder?: number; lastStepOrder?: number }
      >;
      finalizeMessage: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          result: { status: "success" } | { error: string; status: "failed" };
        },
        null
      >;
      getMessagesByIds: FunctionReference<
        "query",
        "internal",
        { messageIds: Array<string> },
        Array<null | {
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | { type: "text"; value: string }
                            | { type: "json"; value: any }
                            | { type: "error-text"; value: string }
                            | { type: "error-json"; value: any }
                            | {
                                type: "content";
                                value: Array<
                                  | { text: string; type: "text" }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<{
                  args?: any;
                  experimental_content?: Array<
                    | { text: string; type: "text" }
                    | { data: string; mimeType?: string; type: "image" }
                  >;
                  isError?: boolean;
                  output?:
                    | { type: "text"; value: string }
                    | { type: "json"; value: any }
                    | { type: "error-text"; value: string }
                    | { type: "error-json"; value: any }
                    | {
                        type: "content";
                        value: Array<
                          | { text: string; type: "text" }
                          | { data: string; mediaType: string; type: "media" }
                        >;
                      };
                  providerExecuted?: boolean;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  result?: any;
                  toolCallId: string;
                  toolName: string;
                  type: "tool-result";
                }>;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      getMessageSearchFields: FunctionReference<
        "query",
        "internal",
        { messageId: string },
        { embedding?: Array<number>; embeddingModel?: string; text?: string }
      >;
      listMessagesByThreadId: FunctionReference<
        "query",
        "internal",
        {
          excludeToolMessages?: boolean;
          order: "asc" | "desc";
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          statuses?: Array<"pending" | "success" | "failed">;
          threadId: string;
          upToAndIncludingMessageId?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            agentName?: string;
            embeddingId?: string;
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            id?: string;
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | { type: "text"; value: string }
                              | { type: "json"; value: any }
                              | { type: "error-text"; value: string }
                              | { type: "error-json"; value: any }
                              | {
                                  type: "content";
                                  value: Array<
                                    | { text: string; type: "text" }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<{
                    args?: any;
                    experimental_content?: Array<
                      | { text: string; type: "text" }
                      | { data: string; mimeType?: string; type: "image" }
                    >;
                    isError?: boolean;
                    output?:
                      | { type: "text"; value: string }
                      | { type: "json"; value: any }
                      | { type: "error-text"; value: string }
                      | { type: "error-json"; value: any }
                      | {
                          type: "content";
                          value: Array<
                            | { text: string; type: "text" }
                            | { data: string; mediaType: string; type: "media" }
                          >;
                        };
                    providerExecuted?: boolean;
                    providerMetadata?: Record<string, Record<string, any>>;
                    providerOptions?: Record<string, Record<string, any>>;
                    result?: any;
                    toolCallId: string;
                    toolName: string;
                    type: "tool-result";
                  }>;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            order: number;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            providerOptions?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status: "pending" | "success" | "failed";
            stepOrder: number;
            text?: string;
            threadId: string;
            tool: boolean;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            userId?: string;
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      searchMessages: FunctionReference<
        "action",
        "internal",
        {
          embedding?: Array<number>;
          embeddingModel?: string;
          limit: number;
          messageRange?: { after: number; before: number };
          searchAllMessagesForUserId?: string;
          targetMessageId?: string;
          text?: string;
          textSearch?: boolean;
          threadId?: string;
          vectorScoreThreshold?: number;
          vectorSearch?: boolean;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | { type: "text"; value: string }
                            | { type: "json"; value: any }
                            | { type: "error-text"; value: string }
                            | { type: "error-json"; value: any }
                            | {
                                type: "content";
                                value: Array<
                                  | { text: string; type: "text" }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<{
                  args?: any;
                  experimental_content?: Array<
                    | { text: string; type: "text" }
                    | { data: string; mimeType?: string; type: "image" }
                  >;
                  isError?: boolean;
                  output?:
                    | { type: "text"; value: string }
                    | { type: "json"; value: any }
                    | { type: "error-text"; value: string }
                    | { type: "error-json"; value: any }
                    | {
                        type: "content";
                        value: Array<
                          | { text: string; type: "text" }
                          | { data: string; mediaType: string; type: "media" }
                        >;
                      };
                  providerExecuted?: boolean;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  result?: any;
                  toolCallId: string;
                  toolName: string;
                  type: "tool-result";
                }>;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      textSearch: FunctionReference<
        "query",
        "internal",
        {
          limit: number;
          searchAllMessagesForUserId?: string;
          targetMessageId?: string;
          text?: string;
          threadId?: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | { type: "text"; value: string }
                            | { type: "json"; value: any }
                            | { type: "error-text"; value: string }
                            | { type: "error-json"; value: any }
                            | {
                                type: "content";
                                value: Array<
                                  | { text: string; type: "text" }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<{
                  args?: any;
                  experimental_content?: Array<
                    | { text: string; type: "text" }
                    | { data: string; mimeType?: string; type: "image" }
                  >;
                  isError?: boolean;
                  output?:
                    | { type: "text"; value: string }
                    | { type: "json"; value: any }
                    | { type: "error-text"; value: string }
                    | { type: "error-json"; value: any }
                    | {
                        type: "content";
                        value: Array<
                          | { text: string; type: "text" }
                          | { data: string; mediaType: string; type: "media" }
                        >;
                      };
                  providerExecuted?: boolean;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  result?: any;
                  toolCallId: string;
                  toolName: string;
                  type: "tool-result";
                }>;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      updateMessage: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          patch: {
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mimeType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | { type: "text"; value: string }
                              | { type: "json"; value: any }
                              | { type: "error-text"; value: string }
                              | { type: "error-json"; value: any }
                              | {
                                  type: "content";
                                  value: Array<
                                    | { text: string; type: "text" }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<{
                    args?: any;
                    experimental_content?: Array<
                      | { text: string; type: "text" }
                      | { data: string; mimeType?: string; type: "image" }
                    >;
                    isError?: boolean;
                    output?:
                      | { type: "text"; value: string }
                      | { type: "json"; value: any }
                      | { type: "error-text"; value: string }
                      | { type: "error-json"; value: any }
                      | {
                          type: "content";
                          value: Array<
                            | { text: string; type: "text" }
                            | { data: string; mediaType: string; type: "media" }
                          >;
                        };
                    providerExecuted?: boolean;
                    providerMetadata?: Record<string, Record<string, any>>;
                    providerOptions?: Record<string, Record<string, any>>;
                    result?: any;
                    toolCallId: string;
                    toolName: string;
                    type: "tool-result";
                  }>;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            provider?: string;
            providerOptions?: Record<string, Record<string, any>>;
            status?: "pending" | "success" | "failed";
          };
        },
        {
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mimeType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | { type: "text"; value: string }
                            | { type: "json"; value: any }
                            | { type: "error-text"; value: string }
                            | { type: "error-json"; value: any }
                            | {
                                type: "content";
                                value: Array<
                                  | { text: string; type: "text" }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<{
                  args?: any;
                  experimental_content?: Array<
                    | { text: string; type: "text" }
                    | { data: string; mimeType?: string; type: "image" }
                  >;
                  isError?: boolean;
                  output?:
                    | { type: "text"; value: string }
                    | { type: "json"; value: any }
                    | { type: "error-text"; value: string }
                    | { type: "error-json"; value: any }
                    | {
                        type: "content";
                        value: Array<
                          | { text: string; type: "text" }
                          | { data: string; mediaType: string; type: "media" }
                        >;
                      };
                  providerExecuted?: boolean;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  result?: any;
                  toolCallId: string;
                  toolName: string;
                  type: "tool-result";
                }>;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }
      >;
    };
    streams: {
      abort: FunctionReference<
        "mutation",
        "internal",
        {
          finalDelta?: {
            end: number;
            parts: Array<any>;
            start: number;
            streamId: string;
          };
          reason: string;
          streamId: string;
        },
        boolean
      >;
      abortByOrder: FunctionReference<
        "mutation",
        "internal",
        { order: number; reason: string; threadId: string },
        boolean
      >;
      addDelta: FunctionReference<
        "mutation",
        "internal",
        { end: number; parts: Array<any>; start: number; streamId: string },
        boolean
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          agentName?: string;
          format?: "UIMessageChunk" | "TextStreamPart";
          model?: string;
          order: number;
          provider?: string;
          providerOptions?: Record<string, Record<string, any>>;
          stepOrder: number;
          threadId: string;
          userId?: string;
        },
        string
      >;
      deleteAllStreamsForThreadIdAsync: FunctionReference<
        "mutation",
        "internal",
        { deltaCursor?: string; streamOrder?: number; threadId: string },
        { deltaCursor?: string; isDone: boolean; streamOrder?: number }
      >;
      deleteAllStreamsForThreadIdSync: FunctionReference<
        "action",
        "internal",
        { threadId: string },
        null
      >;
      deleteStreamAsync: FunctionReference<
        "mutation",
        "internal",
        { cursor?: string; streamId: string },
        null
      >;
      deleteStreamSync: FunctionReference<
        "mutation",
        "internal",
        { streamId: string },
        null
      >;
      finish: FunctionReference<
        "mutation",
        "internal",
        {
          finalDelta?: {
            end: number;
            parts: Array<any>;
            start: number;
            streamId: string;
          };
          streamId: string;
        },
        null
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        { streamId: string },
        null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          startOrder?: number;
          statuses?: Array<"streaming" | "finished" | "aborted">;
          threadId: string;
        },
        Array<{
          agentName?: string;
          format?: "UIMessageChunk" | "TextStreamPart";
          model?: string;
          order: number;
          provider?: string;
          providerOptions?: Record<string, Record<string, any>>;
          status: "streaming" | "finished" | "aborted";
          stepOrder: number;
          streamId: string;
          userId?: string;
        }>
      >;
      listDeltas: FunctionReference<
        "query",
        "internal",
        {
          cursors: Array<{ cursor: number; streamId: string }>;
          threadId: string;
        },
        Array<{
          end: number;
          parts: Array<any>;
          start: number;
          streamId: string;
        }>
      >;
    };
    threads: {
      createThread: FunctionReference<
        "mutation",
        "internal",
        {
          defaultSystemPrompt?: string;
          parentThreadIds?: Array<string>;
          summary?: string;
          title?: string;
          userId?: string;
        },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }
      >;
      deleteAllForThreadIdAsync: FunctionReference<
        "mutation",
        "internal",
        {
          cursor?: string;
          deltaCursor?: string;
          limit?: number;
          messagesDone?: boolean;
          streamOrder?: number;
          streamsDone?: boolean;
          threadId: string;
        },
        { isDone: boolean }
      >;
      deleteAllForThreadIdSync: FunctionReference<
        "action",
        "internal",
        { limit?: number; threadId: string },
        null
      >;
      getThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        } | null
      >;
      listThreadsByUserId: FunctionReference<
        "query",
        "internal",
        {
          order?: "asc" | "desc";
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          userId?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            status: "active" | "archived";
            summary?: string;
            title?: string;
            userId?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      searchThreadTitles: FunctionReference<
        "query",
        "internal",
        { limit: number; query: string; userId?: string | null },
        Array<{
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }>
      >;
      updateThread: FunctionReference<
        "mutation",
        "internal",
        {
          patch: {
            status?: "active" | "archived";
            summary?: string;
            title?: string;
            userId?: string;
          };
          threadId: string;
        },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }
      >;
    };
    users: {
      deleteAllForUserId: FunctionReference<
        "action",
        "internal",
        { userId: string },
        null
      >;
      deleteAllForUserIdAsync: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        boolean
      >;
      listUsersWithThreads: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<string>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    vector: {
      index: {
        deleteBatch: FunctionReference<
          "mutation",
          "internal",
          {
            ids: Array<
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
            >;
          },
          null
        >;
        deleteBatchForThread: FunctionReference<
          "mutation",
          "internal",
          {
            cursor?: string;
            limit: number;
            model: string;
            threadId: string;
            vectorDimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
          },
          { continueCursor: string; isDone: boolean }
        >;
        insertBatch: FunctionReference<
          "mutation",
          "internal",
          {
            vectorDimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
            vectors: Array<{
              messageId?: string;
              model: string;
              table: string;
              threadId?: string;
              userId?: string;
              vector: Array<number>;
            }>;
          },
          Array<
            | string
            | string
            | string
            | string
            | string
            | string
            | string
            | string
            | string
            | string
          >
        >;
        paginate: FunctionReference<
          "query",
          "internal",
          {
            cursor?: string;
            limit: number;
            table?: string;
            targetModel: string;
            vectorDimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
          },
          {
            continueCursor: string;
            ids: Array<
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
            >;
            isDone: boolean;
          }
        >;
        updateBatch: FunctionReference<
          "mutation",
          "internal",
          {
            vectors: Array<{
              id:
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string;
              model: string;
              vector: Array<number>;
            }>;
          },
          null
        >;
      };
    };
  };
  encryptedPii: {
    public: {
      deleteAllUserData: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string },
        number
      >;
      deleteField: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; ref: string },
        boolean
      >;
      exists: FunctionReference<
        "query",
        "internal",
        { ownerId: string; ref: string },
        boolean
      >;
      get: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; ref: string },
        string | null
      >;
      getBatch: FunctionReference<
        "mutation",
        "internal",
        { items: Array<{ ownerId: string; ref: string }> },
        Array<{ ref: string; value: string | null }>
      >;
      getRawEncryptedData: FunctionReference<
        "query",
        "internal",
        { ownerId: string; ref: string },
        {
          algorithm: string;
          ciphertext: string;
          createdAt: number;
          encryptedDek: string;
          iv: string;
          ownerId: string;
          ref: string;
          version: number;
        } | null
      >;
      getUserKey: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string },
        string
      >;
      getUserKeyQuery: FunctionReference<
        "query",
        "internal",
        { ownerId: string },
        string | null
      >;
      listRefs: FunctionReference<
        "query",
        "internal",
        { ownerId: string },
        Array<{ createdAt: number; ref: string }>
      >;
      store: FunctionReference<
        "mutation",
        "internal",
        { ownerId: string; value: string },
        string
      >;
    };
  };
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
          oneBatchOnly?: boolean;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
  neutralCost: {
    aiCosts: {
      addAICost: FunctionReference<
        "action",
        "internal",
        {
          markupMultiplier?: number;
          messageId: string;
          modelId: string;
          providerId: string;
          threadId: string;
          usage: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
        },
        any
      >;
      getAICostByMessageId: FunctionReference<
        "query",
        "internal",
        { messageId: string },
        any
      >;
      getAICostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          costForUser: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          messageId: string;
          threadId: string;
          usage: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
        }>
      >;
      getAICostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          costForUser: {
            cachedInputTokensCost?: number;
            completionTokensCost: number;
            promptTokensCost: number;
            reasoningTokensCost?: number;
            totalCost: number;
          };
          messageId: string;
          threadId: string;
          usage: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
        }>
      >;
      getTotalAICostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        any
      >;
      getTotalAICostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        any
      >;
    };
    markup: {
      deleteMarkup: FunctionReference<
        "mutation",
        "internal",
        {
          modelId?: string;
          providerId: string;
          scope: "provider" | "model" | "tool";
          toolId?: string;
        },
        boolean
      >;
      getMarkupMultiplier: FunctionReference<
        "query",
        "internal",
        { modelId?: string; providerId: string; toolId?: string },
        number
      >;
      getMarkupMultiplierById: FunctionReference<
        "query",
        "internal",
        { markupMultiplierId: string },
        any
      >;
      getMarkupMultipliers: FunctionReference<
        "query",
        "internal",
        {},
        {
          modelMarkupMultipliers: Array<{
            markupMultiplier: number;
            modelId: string;
            providerId: string;
          }>;
          providerMultipliers: Array<{
            markupMultiplier: number;
            providerId: string;
          }>;
          toolMarkupMultipliers: Array<{
            markupMultiplier: number;
            providerId: string;
            toolId: string;
          }>;
        }
      >;
      upsertModelMarkup: FunctionReference<
        "mutation",
        "internal",
        {
          markupMultiplier: number;
          modelId: string;
          providerId: string;
          scope: "model";
        },
        string
      >;
      upsertProviderMarkup: FunctionReference<
        "mutation",
        "internal",
        { markupMultiplier: number; providerId: string; scope: "provider" },
        string
      >;
      upsertToolMarkup: FunctionReference<
        "mutation",
        "internal",
        {
          markupMultiplier: number;
          providerId: string;
          scope: "tool";
          toolId: string;
        },
        string
      >;
    };
    pricing: {
      deleteToolPricing: FunctionReference<
        "mutation",
        "internal",
        { modelId?: string; providerId: string },
        any
      >;
      getAllPricing: FunctionReference<"query", "internal", {}, any>;
      getAllToolPricing: FunctionReference<"query", "internal", {}, any>;
      getPricing: FunctionReference<
        "query",
        "internal",
        { modelId: string; providerId: string },
        any
      >;
      getPricingByProvider: FunctionReference<
        "query",
        "internal",
        { providerId: string },
        any
      >;
      getToolPricing: FunctionReference<
        "query",
        "internal",
        { providerId: string; toolId: string },
        any
      >;
      getToolPricingByProvider: FunctionReference<
        "query",
        "internal",
        { providerId: string },
        any
      >;
      searchPricingByModelName: FunctionReference<
        "query",
        "internal",
        { searchTerm: string },
        any
      >;
      updatePricingData: FunctionReference<
        "action",
        "internal",
        { envKeys?: Record<string, string> },
        any
      >;
      updatePricingTable: FunctionReference<
        "mutation",
        "internal",
        {
          pricingData: Array<{
            lastUpdated: number;
            limits: { context: number; output: number };
            modelId: string;
            modelName: string;
            pricing: {
              cache_read?: number;
              cache_write?: number;
              input: number;
              output: number;
              reasoning?: number;
            };
            providerId: string;
            providerName: string;
          }>;
        },
        any
      >;
      upsertToolPricing: FunctionReference<
        "mutation",
        "internal",
        {
          limits?: {
            maxBytesPerRequest?: number;
            maxConcurrentRequests?: number;
            maxRequestsPerDay?: number;
            maxRequestsPerHour?: number;
            maxRequestsPerMinute?: number;
            maxRequestsPerMonth?: number;
            maxRequestsPerSecond?: number;
            maxTokensPerRequest?: number;
          };
          modelId?: string;
          modelName?: string;
          pricing:
            | {
                costPerCredit: number;
                creditTypes?: Record<string, number>;
                currency: string;
                type: "credits";
              }
            | {
                cache_read?: number;
                cache_write?: number;
                currency: string;
                input: number;
                output: number;
                reasoning?: number;
                type: "tokens";
              }
            | {
                costPerRequest: number;
                currency: string;
                requestTypes?: Record<string, number>;
                type: "requests";
              }
            | {
                computeTypes?: Record<string, number>;
                costPerMs: number;
                currency: string;
                tiers?: Record<string, number>;
                type: "compute";
              }
            | {
                costPerByteSecond: number;
                currency: string;
                storageClasses?: Record<string, number>;
                type: "storage";
              }
            | {
                costPerByteIn?: number;
                costPerByteOut?: number;
                currency: string;
                regions?: Record<string, number>;
                type: "bandwidth";
              }
            | {
                costPerUnit: number;
                currency: string;
                type: "units";
                unitType: string;
              }
            | {
                currency: string;
                tiers: Array<{ from: number; rate: number; to?: number }>;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  costPerUnit: number;
                  name: string;
                  unitType: string;
                }>;
                currency: string;
                type: "composite";
              }
            | {
                currency: string;
                data: any;
                description?: string;
                type: "custom";
              };
          providerId: string;
          providerName: string;
        },
        any
      >;
    };
    toolCosts: {
      addToolCost: FunctionReference<
        "action",
        "internal",
        {
          markupMultiplier?: number;
          messageId: string;
          providerId: string;
          threadId: string;
          toolId: string;
          usage:
            | { creditType?: string; credits: number; type: "credits" }
            | {
                cacheReadTokens?: number;
                cacheWriteTokens?: number;
                inputTokens: number;
                outputTokens: number;
                reasoningTokens?: number;
                type: "tokens";
              }
            | { requestType?: string; requests: number; type: "requests" }
            | {
                computeType?: string;
                durationMs: number;
                tier?: string;
                type: "compute";
              }
            | {
                bytes: number;
                durationSeconds?: number;
                storageClass?: string;
                type: "storage";
              }
            | {
                bytesIn?: number;
                bytesOut?: number;
                region?: string;
                type: "bandwidth";
              }
            | {
                metadata?: Record<string, any>;
                type: "units";
                unitType: string;
                units: number;
              }
            | {
                quantity: number;
                tierName?: string;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  cost?: number;
                  name: string;
                  quantity: number;
                  unitType: string;
                }>;
                type: "composite";
              }
            | { data: any; description?: string; type: "custom" };
          userId?: string;
        },
        any
      >;
      getToolCostsByProviderAndTool: FunctionReference<
        "query",
        "internal",
        { providerId: string; toolId?: string },
        any
      >;
      getToolCostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
          };
          costForUser: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
            markupMultiplier?: number;
          };
          messageId: string;
          providerId: string;
          threadId: string;
          timestamp: number;
          toolId: string;
          usage:
            | { creditType?: string; credits: number; type: "credits" }
            | {
                cacheReadTokens?: number;
                cacheWriteTokens?: number;
                inputTokens: number;
                outputTokens: number;
                reasoningTokens?: number;
                type: "tokens";
              }
            | { requestType?: string; requests: number; type: "requests" }
            | {
                computeType?: string;
                durationMs: number;
                tier?: string;
                type: "compute";
              }
            | {
                bytes: number;
                durationSeconds?: number;
                storageClass?: string;
                type: "storage";
              }
            | {
                bytesIn?: number;
                bytesOut?: number;
                region?: string;
                type: "bandwidth";
              }
            | {
                metadata?: Record<string, any>;
                type: "units";
                unitType: string;
                units: number;
              }
            | {
                quantity: number;
                tierName?: string;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  cost?: number;
                  name: string;
                  quantity: number;
                  unitType: string;
                }>;
                type: "composite";
              }
            | { data: any; description?: string; type: "custom" };
          userId?: string;
        }>
      >;
      getToolCostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          cost: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
          };
          costForUser: {
            amount: number;
            breakdown?:
              | { costPerCredit: number; credits: number; type: "credits" }
              | {
                  cacheReadTokensCost?: number;
                  cacheWriteTokensCost?: number;
                  inputTokensCost?: number;
                  outputTokensCost?: number;
                  reasoningTokensCost?: number;
                  type: "tokens";
                }
              | { costPerRequest: number; requests: number; type: "requests" }
              | {
                  computeType?: string;
                  costPerMs: number;
                  durationMs: number;
                  type: "compute";
                }
              | {
                  bytes: number;
                  costPerByteSecond: number;
                  durationSeconds: number;
                  type: "storage";
                }
              | {
                  bytesInCost?: number;
                  bytesOutCost?: number;
                  type: "bandwidth";
                }
              | {
                  costPerUnit: number;
                  type: "units";
                  unitType: string;
                  units: number;
                }
              | {
                  effectiveRate: number;
                  quantity: number;
                  tierApplied: string;
                  type: "tiered";
                }
              | {
                  components: Array<{
                    name: string;
                    quantity: number;
                    totalCost: number;
                    unitCost: number;
                  }>;
                  type: "composite";
                }
              | { data: any; type: "custom" };
            currency: string;
            markupMultiplier?: number;
          };
          messageId: string;
          providerId: string;
          threadId: string;
          timestamp: number;
          toolId: string;
          usage:
            | { creditType?: string; credits: number; type: "credits" }
            | {
                cacheReadTokens?: number;
                cacheWriteTokens?: number;
                inputTokens: number;
                outputTokens: number;
                reasoningTokens?: number;
                type: "tokens";
              }
            | { requestType?: string; requests: number; type: "requests" }
            | {
                computeType?: string;
                durationMs: number;
                tier?: string;
                type: "compute";
              }
            | {
                bytes: number;
                durationSeconds?: number;
                storageClass?: string;
                type: "storage";
              }
            | {
                bytesIn?: number;
                bytesOut?: number;
                region?: string;
                type: "bandwidth";
              }
            | {
                metadata?: Record<string, any>;
                type: "units";
                unitType: string;
                units: number;
              }
            | {
                quantity: number;
                tierName?: string;
                type: "tiered";
                unitType: string;
              }
            | {
                components: Array<{
                  cost?: number;
                  name: string;
                  quantity: number;
                  unitType: string;
                }>;
                type: "composite";
              }
            | { data: any; description?: string; type: "custom" };
          userId?: string;
        }>
      >;
      getTotalToolCostsByThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        any
      >;
      getTotalToolCostsByUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        any
      >;
    };
  };
  pushNotifications: {
    public: {
      deleteNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      getNotification: FunctionReference<
        "query",
        "internal",
        { id: string; logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        null | {
          _contentAvailable?: boolean;
          _creationTime: number;
          badge?: number;
          body?: string;
          categoryId?: string;
          channelId?: string;
          data?: any;
          expiration?: number;
          interruptionLevel?:
            | "active"
            | "critical"
            | "passive"
            | "time-sensitive";
          mutableContent?: boolean;
          numPreviousFailures: number;
          priority?: "default" | "normal" | "high";
          sound?: string | null;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title?: string;
          ttl?: number;
        }
      >;
      getNotificationsForUser: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          userId: string;
        },
        Array<{
          _contentAvailable?: boolean;
          _creationTime: number;
          badge?: number;
          body?: string;
          categoryId?: string;
          channelId?: string;
          data?: any;
          expiration?: number;
          id: string;
          interruptionLevel?:
            | "active"
            | "critical"
            | "passive"
            | "time-sensitive";
          mutableContent?: boolean;
          numPreviousFailures: number;
          priority?: "default" | "normal" | "high";
          sound?: string | null;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title?: string;
          ttl?: number;
        }>
      >;
      getStatusForUser: FunctionReference<
        "query",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        { hasToken: boolean; paused: boolean }
      >;
      pauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      recordPushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        {
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          pushToken: string;
          userId: string;
        },
        null
      >;
      removePushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        boolean
      >;
      sendPushNotification: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notification: {
            _contentAvailable?: boolean;
            badge?: number;
            body?: string;
            categoryId?: string;
            channelId?: string;
            data?: any;
            expiration?: number;
            interruptionLevel?:
              | "active"
              | "critical"
              | "passive"
              | "time-sensitive";
            mutableContent?: boolean;
            priority?: "default" | "normal" | "high";
            sound?: string | null;
            subtitle?: string;
            title?: string;
            ttl?: number;
          };
          userId: string;
        },
        string | null
      >;
      sendPushNotificationBatch: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notifications: Array<{
            notification: {
              _contentAvailable?: boolean;
              badge?: number;
              body?: string;
              categoryId?: string;
              channelId?: string;
              data?: any;
              expiration?: number;
              interruptionLevel?:
                | "active"
                | "critical"
                | "passive"
                | "time-sensitive";
              mutableContent?: boolean;
              priority?: "default" | "normal" | "high";
              sound?: string | null;
              subtitle?: string;
              title?: string;
              ttl?: number;
            };
            userId: string;
          }>;
        },
        Array<string | null>
      >;
      shutdown: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        { data?: any; message: string }
      >;
      unpauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
    };
  };
  workpool: {
    config: {
      update: FunctionReference<
        "mutation",
        "internal",
        {
          logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          maxParallelism?: number;
        },
        any
      >;
    };
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        },
        any
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        {
          before?: number;
          limit?: number;
          logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        },
        any
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          config: {
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
          };
          fnArgs: any;
          fnHandle: string;
          fnName: string;
          fnType: "action" | "mutation" | "query";
          onComplete?: { context?: any; fnHandle: string };
          retryBehavior?: {
            base: number;
            initialBackoffMs: number;
            maxAttempts: number;
          };
          runAt: number;
        },
        string
      >;
      enqueueBatch: FunctionReference<
        "mutation",
        "internal",
        {
          config: {
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
          };
          items: Array<{
            fnArgs: any;
            fnHandle: string;
            fnName: string;
            fnType: "action" | "mutation" | "query";
            onComplete?: { context?: any; fnHandle: string };
            retryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            runAt: number;
          }>;
        },
        Array<string>
      >;
      status: FunctionReference<
        "query",
        "internal",
        { id: string },
        | { previousAttempts: number; state: "pending" }
        | { previousAttempts: number; state: "running" }
        | { state: "finished" }
      >;
      statusBatch: FunctionReference<
        "query",
        "internal",
        { ids: Array<string> },
        Array<
          | { previousAttempts: number; state: "pending" }
          | { previousAttempts: number; state: "running" }
          | { state: "finished" }
        >
      >;
    };
  };
  workflow: {
    event: {
      create: FunctionReference<
        "mutation",
        "internal",
        { name: string; workflowId: string },
        string
      >;
      send: FunctionReference<
        "mutation",
        "internal",
        {
          eventId?: string;
          name?: string;
          result:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId?: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        string
      >;
    };
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        { shortCircuit?: boolean; workflowId: string },
        {
          blocked?: boolean;
          journalEntries: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          ok: boolean;
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | { base: number; initialBackoffMs: number; maxAttempts: number };
            schedulerOptions?: { runAt?: number } | { runAfter?: number };
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
          }>;
          workflowId: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        Array<{
          _creationTime: number;
          _id: string;
          step:
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                functionType: "query" | "mutation" | "action";
                handle: string;
                inProgress: boolean;
                kind?: "function";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workId?: string;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                handle: string;
                inProgress: boolean;
                kind: "workflow";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workflowId?: string;
              }
            | {
                args: { eventId?: string };
                argsSize: number;
                completedAt?: number;
                eventId?: string;
                inProgress: boolean;
                kind: "event";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
              };
          stepNumber: number;
          workflowId: string;
        }>
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        null
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        boolean
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          maxParallelism?: number;
          onComplete?: { context?: any; fnHandle: string };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
        {
          inProgress: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      listSteps: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          workflowId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            completedAt?: number;
            eventId?: string;
            kind: "function" | "workflow" | "event";
            name: string;
            nestedWorkflowId?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt: number;
            stepId: string;
            stepNumber: number;
            workId?: string;
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
  selfStaticHosting: {
    lib: {
      gcOldAssets: FunctionReference<
        "mutation",
        "internal",
        { currentDeploymentId: string },
        Array<string>
      >;
      generateUploadUrl: FunctionReference<"mutation", "internal", {}, string>;
      getByPath: FunctionReference<
        "query",
        "internal",
        { path: string },
        {
          _creationTime: number;
          _id: string;
          contentType: string;
          deploymentId: string;
          path: string;
          storageId: string;
        } | null
      >;
      getCurrentDeployment: FunctionReference<
        "query",
        "internal",
        {},
        {
          _creationTime: number;
          _id: string;
          currentDeploymentId: string;
          deployedAt: number;
        } | null
      >;
      listAssets: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          contentType: string;
          deploymentId: string;
          path: string;
          storageId: string;
        }>
      >;
      recordAsset: FunctionReference<
        "mutation",
        "internal",
        {
          contentType: string;
          deploymentId: string;
          path: string;
          storageId: string;
        },
        string | null
      >;
      setCurrentDeployment: FunctionReference<
        "mutation",
        "internal",
        { deploymentId: string },
        null
      >;
    };
  };
};
