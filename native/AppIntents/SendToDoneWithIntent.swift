import AppIntents
import Foundation

@available(iOS 16.0, *)
struct SendToDoneWithIntent: AppIntent {
    static var title: LocalizedStringResource = "Send to DoneWith"
    static var description = IntentDescription("Send text to DoneWith for AI processing to extract calendar events and action items.")

    // Open the app when the intent runs
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Text to Process")
    var text: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Encode the text for URL
        guard let encodedText = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return .result(dialog: "Failed to process text")
        }

        // Create deep link URL
        let urlString = "donewith://shortcuts/process?text=\(encodedText)"

        // Store the URL for the app to process when it launches
        UserDefaults.standard.set(urlString, forKey: "pendingShortcutURL")

        return .result(dialog: "Processing your text in DoneWith...")
    }
}

@available(iOS 16.0, *)
struct DoneWithShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SendToDoneWithIntent(),
            phrases: [
                "Send to \(.applicationName)",
                "Process with \(.applicationName)",
                "Extract events with \(.applicationName)",
                "Find action items with \(.applicationName)"
            ],
            shortTitle: "Send to DoneWith",
            systemImageName: "envelope.badge"
        )
    }
}
