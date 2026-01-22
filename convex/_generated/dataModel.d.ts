/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
  AnyDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */

export type DataModel = {
  aiProcessingQueue: {
    document: {
      createdAt: number;
      emailId: Id<"emails">;
      error?: string;
      processedAt?: number;
      status: "pending" | "processing" | "completed" | "failed";
      userId: Id<"users">;
      _id: Id<"aiProcessingQueue">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "emailId"
      | "error"
      | "processedAt"
      | "status"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email: ["emailId", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  attachments: {
    document: {
      attachmentId: string;
      contentId?: string;
      createdAt: number;
      emailId: Id<"emails">;
      filename: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      mimeType: string;
      size: number;
      storageId?: Id<"_storage">;
      userId: Id<"users">;
      _id: Id<"attachments">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "attachmentId"
      | "contentId"
      | "createdAt"
      | "emailId"
      | "filename"
      | "filename.__encrypted"
      | "filename.c"
      | "filename.i"
      | "filename.k"
      | "filename.v"
      | "mimeType"
      | "size"
      | "storageId"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email: ["emailId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  changelogs: {
    document: {
      createdAt: number;
      description: string;
      publishedAt: number;
      title: string;
      type: "feature" | "improvement" | "bugfix" | "other";
      version: string;
      _id: Id<"changelogs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "description"
      | "publishedAt"
      | "title"
      | "type"
      | "version";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_published: ["publishedAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  contacts: {
    document: {
      avatarStorageId?: Id<"_storage">;
      avatarUrl?: string;
      email: string;
      emailCount: number;
      facts?: { __encrypted: true; c: string; i: string; k: string; v: number };
      lastEmailAt: number;
      name?: { __encrypted: true; c: string; i: string; k: string; v: number };
      relationship?: "vip" | "regular" | "unknown";
      relationshipSummary?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      userId: Id<"users">;
      writingStyle?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      _id: Id<"contacts">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "avatarStorageId"
      | "avatarUrl"
      | "email"
      | "emailCount"
      | "facts"
      | "facts.__encrypted"
      | "facts.c"
      | "facts.i"
      | "facts.k"
      | "facts.v"
      | "lastEmailAt"
      | "name"
      | "name.__encrypted"
      | "name.c"
      | "name.i"
      | "name.k"
      | "name.v"
      | "relationship"
      | "relationshipSummary"
      | "relationshipSummary.__encrypted"
      | "relationshipSummary.c"
      | "relationshipSummary.i"
      | "relationshipSummary.k"
      | "relationshipSummary.v"
      | "userId"
      | "writingStyle"
      | "writingStyle.__encrypted"
      | "writingStyle.c"
      | "writingStyle.i"
      | "writingStyle.k"
      | "writingStyle.v";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email: ["email", "_creationTime"];
      by_user: ["userId", "_creationTime"];
      by_user_email: ["userId", "email", "_creationTime"];
      by_user_last_email: ["userId", "lastEmailAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  emailBodies: {
    document: {
      bodyFull: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      bodyHtml?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      emailId: Id<"emails">;
      rawPayload?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      _id: Id<"emailBodies">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "bodyFull"
      | "bodyFull.__encrypted"
      | "bodyFull.c"
      | "bodyFull.i"
      | "bodyFull.k"
      | "bodyFull.v"
      | "bodyHtml"
      | "bodyHtml.__encrypted"
      | "bodyHtml.c"
      | "bodyHtml.i"
      | "bodyHtml.k"
      | "bodyHtml.v"
      | "emailId"
      | "rawPayload"
      | "rawPayload.__encrypted"
      | "rawPayload.c"
      | "rawPayload.i"
      | "rawPayload.k"
      | "rawPayload.v";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email: ["emailId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  emails: {
    document: {
      bodyPreview: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      cc?: Array<Id<"contacts">>;
      direction?: "incoming" | "outgoing";
      externalId: string;
      from: Id<"contacts">;
      fromName?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      isPunted?: boolean;
      isRead: boolean;
      isSubscription?: boolean;
      isTriaged: boolean;
      lastReminderAt?: number;
      listUnsubscribe?: string;
      listUnsubscribePost?: boolean;
      provider: "gmail" | "outlook" | "imap";
      receivedAt: number;
      subject: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      threadId?: string;
      to: Array<Id<"contacts">>;
      triageAction?: "done" | "reply_needed" | "delegated";
      triagedAt?: number;
      userId: Id<"users">;
      _id: Id<"emails">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "bodyPreview"
      | "bodyPreview.__encrypted"
      | "bodyPreview.c"
      | "bodyPreview.i"
      | "bodyPreview.k"
      | "bodyPreview.v"
      | "cc"
      | "direction"
      | "externalId"
      | "from"
      | "fromName"
      | "fromName.__encrypted"
      | "fromName.c"
      | "fromName.i"
      | "fromName.k"
      | "fromName.v"
      | "isPunted"
      | "isRead"
      | "isSubscription"
      | "isTriaged"
      | "lastReminderAt"
      | "listUnsubscribe"
      | "listUnsubscribePost"
      | "provider"
      | "receivedAt"
      | "subject"
      | "subject.__encrypted"
      | "subject.c"
      | "subject.i"
      | "subject.k"
      | "subject.v"
      | "threadId"
      | "to"
      | "triageAction"
      | "triagedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_external_id: ["externalId", "provider", "_creationTime"];
      by_from: ["from", "_creationTime"];
      by_thread: ["userId", "threadId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
      by_user_received: ["userId", "receivedAt", "_creationTime"];
      by_user_reply_needed: [
        "userId",
        "triageAction",
        "triagedAt",
        "_creationTime",
      ];
      by_user_triaged_at: ["userId", "triagedAt", "_creationTime"];
      by_user_untriaged: ["userId", "isTriaged", "receivedAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  emailSummaries: {
    document: {
      actionDescription?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      actionRequired?: "reply" | "action" | "fyi" | "none";
      actionableItems?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      calendarEvent?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      calendarEventId?: string;
      calendarEventLink?: string;
      createdAt: number;
      deadline?: string;
      deadlineDescription?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      deadlineReminderSent?: boolean;
      emailId: Id<"emails">;
      embedding?: Array<number>;
      importantAttachmentIds?: Array<Id<"attachments">>;
      meetingRequest?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      quickReplies?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      shouldAcceptCalendar?: boolean;
      suggestedReply?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      summary: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      urgencyReason: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      urgencyScore: number;
      _id: Id<"emailSummaries">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "actionableItems"
      | "actionableItems.__encrypted"
      | "actionableItems.c"
      | "actionableItems.i"
      | "actionableItems.k"
      | "actionableItems.v"
      | "actionDescription"
      | "actionDescription.__encrypted"
      | "actionDescription.c"
      | "actionDescription.i"
      | "actionDescription.k"
      | "actionDescription.v"
      | "actionRequired"
      | "calendarEvent"
      | "calendarEvent.__encrypted"
      | "calendarEvent.c"
      | "calendarEvent.i"
      | "calendarEvent.k"
      | "calendarEvent.v"
      | "calendarEventId"
      | "calendarEventLink"
      | "createdAt"
      | "deadline"
      | "deadlineDescription"
      | "deadlineDescription.__encrypted"
      | "deadlineDescription.c"
      | "deadlineDescription.i"
      | "deadlineDescription.k"
      | "deadlineDescription.v"
      | "deadlineReminderSent"
      | "emailId"
      | "embedding"
      | "importantAttachmentIds"
      | "meetingRequest"
      | "meetingRequest.__encrypted"
      | "meetingRequest.c"
      | "meetingRequest.i"
      | "meetingRequest.k"
      | "meetingRequest.v"
      | "quickReplies"
      | "quickReplies.__encrypted"
      | "quickReplies.c"
      | "quickReplies.i"
      | "quickReplies.k"
      | "quickReplies.v"
      | "shouldAcceptCalendar"
      | "suggestedReply"
      | "suggestedReply.__encrypted"
      | "suggestedReply.c"
      | "suggestedReply.i"
      | "suggestedReply.k"
      | "suggestedReply.v"
      | "summary"
      | "summary.__encrypted"
      | "summary.c"
      | "summary.i"
      | "summary.k"
      | "summary.v"
      | "urgencyReason"
      | "urgencyReason.__encrypted"
      | "urgencyReason.c"
      | "urgencyReason.i"
      | "urgencyReason.k"
      | "urgencyReason.v"
      | "urgencyScore";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_deadline: ["deadline", "_creationTime"];
      by_email: ["emailId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {
      by_embedding: {
        vectorField: "embedding";
        dimensions: number;
        filterFields: "emailId";
      };
    };
  };
  featureRequests: {
    document: {
      branchName?: string;
      claudeOutput?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      claudeSuccess?: boolean;
      combinedIntoId?: Id<"featureRequests">;
      commitHash?: string;
      completedAt?: number;
      createdAt: number;
      debugLogs?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      easDashboardUrl?: string;
      easUpdateId?: string;
      easUpdateMessage?: string;
      error?: { __encrypted: true; c: string; i: string; k: string; v: number };
      progressMessage?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      progressStep?:
        | "cloning"
        | "implementing"
        | "pushing"
        | "merging"
        | "deploying_backend"
        | "uploading"
        | "ready";
      startedAt?: number;
      status: "pending" | "processing" | "completed" | "failed" | "combined";
      transcript: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      userId: Id<"users">;
      _id: Id<"featureRequests">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "branchName"
      | "claudeOutput"
      | "claudeOutput.__encrypted"
      | "claudeOutput.c"
      | "claudeOutput.i"
      | "claudeOutput.k"
      | "claudeOutput.v"
      | "claudeSuccess"
      | "combinedIntoId"
      | "commitHash"
      | "completedAt"
      | "createdAt"
      | "debugLogs"
      | "debugLogs.__encrypted"
      | "debugLogs.c"
      | "debugLogs.i"
      | "debugLogs.k"
      | "debugLogs.v"
      | "easDashboardUrl"
      | "easUpdateId"
      | "easUpdateMessage"
      | "error"
      | "error.__encrypted"
      | "error.c"
      | "error.i"
      | "error.k"
      | "error.v"
      | "progressMessage"
      | "progressMessage.__encrypted"
      | "progressMessage.c"
      | "progressMessage.i"
      | "progressMessage.k"
      | "progressMessage.v"
      | "progressStep"
      | "startedAt"
      | "status"
      | "transcript"
      | "transcript.__encrypted"
      | "transcript.c"
      | "transcript.i"
      | "transcript.k"
      | "transcript.v"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_status: ["status", "createdAt", "_creationTime"];
      by_user: ["userId", "createdAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  subscriptions: {
    document: {
      emailCount: number;
      firstEmailAt: number;
      lastEmailAt: number;
      listUnsubscribe?: string;
      listUnsubscribePost?: boolean;
      mostRecentEmailId?: Id<"emails">;
      mostRecentSubject?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      senderDomain: string;
      senderEmail: string;
      senderName?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      unsubscribeMethod?: "http_post" | "http_get" | "mailto" | "none";
      unsubscribeStatus:
        | "subscribed"
        | "pending"
        | "processing"
        | "unsubscribed"
        | "failed"
        | "manual_required";
      unsubscribedAt?: number;
      userId: Id<"users">;
      _id: Id<"subscriptions">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "emailCount"
      | "firstEmailAt"
      | "lastEmailAt"
      | "listUnsubscribe"
      | "listUnsubscribePost"
      | "mostRecentEmailId"
      | "mostRecentSubject"
      | "mostRecentSubject.__encrypted"
      | "mostRecentSubject.c"
      | "mostRecentSubject.i"
      | "mostRecentSubject.k"
      | "mostRecentSubject.v"
      | "senderDomain"
      | "senderEmail"
      | "senderName"
      | "senderName.__encrypted"
      | "senderName.c"
      | "senderName.i"
      | "senderName.k"
      | "senderName.v"
      | "unsubscribedAt"
      | "unsubscribeMethod"
      | "unsubscribeStatus"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_user: ["userId", "_creationTime"];
      by_user_last_email: ["userId", "lastEmailAt", "_creationTime"];
      by_user_sender: ["userId", "senderEmail", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  users: {
    document: {
      avatarUrl?: string;
      connectedProviders?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      createdAt?: number;
      email: string;
      gmailAccessToken?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      gmailRefreshToken?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      gmailTokenExpiresAt?: number;
      lastEmailSyncAt?: number;
      lastOpenedAt?: number;
      name?: { __encrypted: true; c: string; i: string; k: string; v: number };
      preferences?: { autoProcessEmails?: boolean; urgencyThreshold?: number };
      workosId?: string;
      workosRefreshToken?: {
        __encrypted: true;
        c: string;
        i: string;
        k: string;
        v: number;
      };
      _id: Id<"users">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "avatarUrl"
      | "connectedProviders"
      | "connectedProviders.__encrypted"
      | "connectedProviders.c"
      | "connectedProviders.i"
      | "connectedProviders.k"
      | "connectedProviders.v"
      | "createdAt"
      | "email"
      | "gmailAccessToken"
      | "gmailAccessToken.__encrypted"
      | "gmailAccessToken.c"
      | "gmailAccessToken.i"
      | "gmailAccessToken.k"
      | "gmailAccessToken.v"
      | "gmailRefreshToken"
      | "gmailRefreshToken.__encrypted"
      | "gmailRefreshToken.c"
      | "gmailRefreshToken.i"
      | "gmailRefreshToken.k"
      | "gmailRefreshToken.v"
      | "gmailTokenExpiresAt"
      | "lastEmailSyncAt"
      | "lastOpenedAt"
      | "name"
      | "name.__encrypted"
      | "name.c"
      | "name.i"
      | "name.k"
      | "name.v"
      | "preferences"
      | "preferences.autoProcessEmails"
      | "preferences.urgencyThreshold"
      | "workosId"
      | "workosRefreshToken"
      | "workosRefreshToken.__encrypted"
      | "workosRefreshToken.c"
      | "workosRefreshToken.i"
      | "workosRefreshToken.k"
      | "workosRefreshToken.v";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email: ["email", "_creationTime"];
      by_workos_id: ["workosId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
};

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using `db.get(tableName, id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;
