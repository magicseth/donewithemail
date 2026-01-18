//
//  NotificationService.swift
//  NotificationServiceExtension
//
//  Created by Seth Raphael on 1/18/26.
//

import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    
    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }
        
        // Try to get the sender avatar URL from different possible locations in the payload
        var senderAvatarUrlString: String?
        
        // Expo push notifications may have data in different structures
        let userInfo = request.content.userInfo
        
        // Try direct data access (Expo format)
        if let data = userInfo["data"] as? [String: Any] {
            senderAvatarUrlString = data["senderAvatar"] as? String
        }
        
        // Try body.data format (alternative Expo format)
        if senderAvatarUrlString == nil,
           let body = userInfo["body"] as? [String: Any],
           let data = body["data"] as? [String: Any] {
            senderAvatarUrlString = data["senderAvatar"] as? String
        }
        
        // Try aps.data format
        if senderAvatarUrlString == nil,
           let aps = userInfo["aps"] as? [String: Any],
           let data = aps["data"] as? [String: Any] {
            senderAvatarUrlString = data["senderAvatar"] as? String
        }
        
        // Try direct senderAvatar at root level
        if senderAvatarUrlString == nil {
            senderAvatarUrlString = userInfo["senderAvatar"] as? String
        }
        
        guard let avatarUrlString = senderAvatarUrlString,
              let avatarUrl = URL(string: avatarUrlString) else {
            // No avatar URL found, deliver notification as-is
            contentHandler(bestAttemptContent)
            return
        }
        
        // Download the avatar image
        downloadImage(from: avatarUrl) { [weak self] attachment in
            if let attachment = attachment {
                bestAttemptContent.attachments = [attachment]
            }
            contentHandler(bestAttemptContent)
        }
    }
    
    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
    
    private func downloadImage(from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { localUrl, response, error in
            guard let localUrl = localUrl, error == nil else {
                print("[NotificationService] Failed to download image: \(error?.localizedDescription ?? "unknown error")")
                completion(nil)
                return
            }
            
            // Determine file extension from response
            var fileExtension = "jpg"
            if let mimeType = (response as? HTTPURLResponse)?.mimeType {
                if mimeType.contains("png") {
                    fileExtension = "png"
                } else if mimeType.contains("gif") {
                    fileExtension = "gif"
                }
            }
            
            // Create a unique file name
            let fileManager = FileManager.default
            let tmpDir = fileManager.temporaryDirectory
            let uniqueName = UUID().uuidString + "." + fileExtension
            let tmpFile = tmpDir.appendingPathComponent(uniqueName)
            
            do {
                // Copy downloaded file to tmp location
                if fileManager.fileExists(atPath: tmpFile.path) {
                    try fileManager.removeItem(at: tmpFile)
                }
                try fileManager.copyItem(at: localUrl, to: tmpFile)
                
                // Create attachment
                let attachment = try UNNotificationAttachment(
                    identifier: "senderAvatar",
                    url: tmpFile,
                    options: [
                        UNNotificationAttachmentOptionsThumbnailHiddenKey: false
                    ]
                )
                completion(attachment)
            } catch {
                print("[NotificationService] Error creating notification attachment: \(error)")
                completion(nil)
            }
        }
        task.resume()
    }
}
