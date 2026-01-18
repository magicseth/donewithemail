//
//  NotificationService.swift
//  NotificationServiceExtension
//
//  Created by Seth Raphael on 1/18/26.
//
//  This extension intercepts push notifications to add sender avatars.
//  Two modes controlled by "avatarStyle" in payload:
//    - "attachment" (default): Thumbnail on right side
//    - "communication": Circular avatar on left (iOS 15+ Communication Notification)
//
//  DEBUG: View logs in Console.app, filter by "NotificationService" or process name.
//

import UserNotifications
import Intents

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    private var lastError: String = ""

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        NSLog("[NotificationService] Extension started")

        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            NSLog("[NotificationService] ERROR: Failed to get mutable content")
            contentHandler(request.content)
            return
        }

        // Add bell emoji to confirm extension is running
        let originalTitle = bestAttemptContent.title
        bestAttemptContent.title = "🔔 " + originalTitle

        let userInfo = request.content.userInfo
        NSLog("[NotificationService] userInfo keys: %@", Array(userInfo.keys))

        // Extract avatar URL from various possible locations
        let avatarUrlString = extractValue(key: "senderAvatar", from: userInfo)
        let senderName = extractValue(key: "senderName", from: userInfo) ?? bestAttemptContent.title
        let avatarStyle = extractValue(key: "avatarStyle", from: userInfo) ?? "attachment"

        NSLog("[NotificationService] avatarStyle: %@, senderName: %@", avatarStyle, senderName)

        guard let avatarUrlString = avatarUrlString, let avatarUrl = URL(string: avatarUrlString) else {
            NSLog("[NotificationService] No valid avatar URL")
            let keyList = userInfo.keys.compactMap { $0 as? String }.joined(separator: ",")
            bestAttemptContent.body = "[KEYS:\(keyList)] " + bestAttemptContent.body
            contentHandler(bestAttemptContent)
            return
        }

        NSLog("[NotificationService] Downloading from: %@", avatarUrl.absoluteString)

        // Download the avatar
        downloadImageData(from: avatarUrl) { [weak self] imageData in
            guard let self = self else {
                contentHandler(bestAttemptContent)
                return
            }

            guard let imageData = imageData else {
                NSLog("[NotificationService] Download failed: %@", self.lastError)
                bestAttemptContent.body = "[DL FAILED:\(self.lastError)] " + bestAttemptContent.body
                contentHandler(bestAttemptContent)
                return
            }

            NSLog("[NotificationService] Downloaded %d bytes, using style: %@", imageData.count, avatarStyle)

            if avatarStyle == "communication" {
                // Communication Notification path (circular avatar on left)
                NSLog("[NotificationService] Trying communication path with %d bytes", imageData.count)
                if let updatedContent = self.createCommunicationNotification(
                    from: bestAttemptContent,
                    senderName: senderName,
                    avatarData: imageData
                ) {
                    NSLog("[NotificationService] SUCCESS: Communication notification created")
                    // Add debug marker to body
                    if let mutableUpdated = updatedContent.mutableCopy() as? UNMutableNotificationContent {
                        mutableUpdated.body = "[COMM OK] " + mutableUpdated.body
                        contentHandler(mutableUpdated)
                    } else {
                        contentHandler(updatedContent)
                    }
                    return
                } else {
                    NSLog("[NotificationService] Communication failed, falling back to attachment")
                    bestAttemptContent.body = "[COMM FAILED:\(self.lastError)] " + bestAttemptContent.body
                }
            }

            // Attachment path (thumbnail on right) - default or fallback
            if let attachment = self.createAttachment(from: imageData) {
                bestAttemptContent.attachments = [attachment]
                NSLog("[NotificationService] SUCCESS: Attachment added")
            } else {
                NSLog("[NotificationService] Attachment failed: %@", self.lastError)
                bestAttemptContent.body = "[ATTACH FAILED:\(self.lastError)] " + bestAttemptContent.body
            }

            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        NSLog("[NotificationService] Time expired")
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Helper to extract values from various payload locations

    private func extractValue(key: String, from userInfo: [AnyHashable: Any]) -> String? {
        // 1. Direct at root level
        if let value = userInfo[key] as? String {
            return value
        }

        // 2. Inside "body" dictionary
        if let body = userInfo["body"] as? [String: Any], let value = body[key] as? String {
            return value
        }

        // 3. Inside "data" dictionary
        if let data = userInfo["data"] as? [String: Any], let value = data[key] as? String {
            return value
        }

        // 4. Body as JSON string
        if let bodyString = userInfo["body"] as? String,
           let jsonData = bodyString.data(using: .utf8),
           let body = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
           let value = body[key] as? String {
            return value
        }

        return nil
    }

    // MARK: - Attachment Path (thumbnail on right)

    private func createAttachment(from imageData: Data) -> UNNotificationAttachment? {
        let fileManager = FileManager.default
        let tmpFile = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")

        do {
            try imageData.write(to: tmpFile)
            return try UNNotificationAttachment(
                identifier: "senderAvatar",
                url: tmpFile,
                options: [UNNotificationAttachmentOptionsThumbnailHiddenKey: false]
            )
        } catch {
            lastError = "attach:\(error.localizedDescription)"
            return nil
        }
    }

    // MARK: - Communication Notification Path (circular avatar on left)

    private func createCommunicationNotification(
        from content: UNMutableNotificationContent,
        senderName: String,
        avatarData: Data
    ) -> UNNotificationContent? {

        // Save image to file first (sometimes INImage works better with file URLs)
        let fileManager = FileManager.default
        let tmpFile = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")

        do {
            try avatarData.write(to: tmpFile)
            NSLog("[NotificationService] Saved avatar to: %@", tmpFile.path)
        } catch {
            NSLog("[NotificationService] Failed to save avatar: %@", error.localizedDescription)
            lastError = "save:\(error.localizedDescription)"
            return nil
        }

        // Create sender's avatar image from file URL
        let personImage = INImage(url: tmpFile)

        // Create person handle
        let handle = INPersonHandle(value: senderName, type: .unknown)

        // Create sender person
        let sender = INPerson(
            personHandle: handle,
            nameComponents: nil,
            displayName: senderName,
            image: personImage,
            contactIdentifier: nil,
            customIdentifier: senderName
        )

        // Create send message intent
        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: nil,
            conversationIdentifier: senderName,
            serviceName: nil,
            sender: sender,
            attachments: nil
        )

        // Set the sender image on the intent directly (iOS 15+)
        intent.setImage(personImage, forParameterNamed: \.sender)

        // Donate the interaction synchronously (wait for completion)
        let semaphore = DispatchSemaphore(value: 0)
        var donationError: Error?

        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate { error in
            donationError = error
            if let error = error {
                NSLog("[NotificationService] Interaction donation failed: %@", error.localizedDescription)
            } else {
                NSLog("[NotificationService] Interaction donation succeeded")
            }
            semaphore.signal()
        }

        // Wait up to 5 seconds for donation
        _ = semaphore.wait(timeout: .now() + 5)

        if let error = donationError {
            lastError = "donate:\(error.localizedDescription)"
            // Continue anyway, donation failure shouldn't prevent the notification
        }

        // Update notification content with the intent
        do {
            let updatedContent = try content.updating(from: intent)
            NSLog("[NotificationService] Content updated with intent successfully")
            return updatedContent
        } catch {
            lastError = "comm:\(error.localizedDescription)"
            NSLog("[NotificationService] Communication update failed: %@", error.localizedDescription)
            return nil
        }
    }

    // MARK: - Download

    private func downloadImageData(from url: URL, completion: @escaping (Data?) -> Void) {
        let task = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let error = error {
                self?.lastError = error.localizedDescription
                completion(nil)
                return
            }

            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                self?.lastError = "HTTP \(httpResponse.statusCode)"
                completion(nil)
                return
            }

            completion(data)
        }
        task.resume()
    }
}
