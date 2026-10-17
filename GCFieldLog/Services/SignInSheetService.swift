import Foundation

struct SignInDraftRow: Identifiable, Hashable {
    var id: UUID
    var name: String
    var hours: Double
    var matchedCrewID: UUID?
}

struct SignInDraft: Hashable {
    var rows: [SignInDraftRow]
    var note: String
    var usedVisionAPI: Bool
}

/// Foreman snaps a paper sign-in sheet. Grok would read names/hours; demo is stubbed.
protocol SignInSheetReading: Sendable {
    func read(imagePNG: Data?) async -> SignInDraft
}

struct StubSignInSheetService: SignInSheetReading {
    func read(imagePNG: Data?) async -> SignInDraft {
        _ = imagePNG
        return SignInDraft(
            rows: [
                .init(id: UUID(), name: "Pat Nguyen", hours: 8, matchedCrewID: DemoIDs.pat),
                .init(id: UUID(), name: "Alex Rivera", hours: 10, matchedCrewID: DemoIDs.alex),
                .init(id: UUID(), name: "Sam Ortiz", hours: 8, matchedCrewID: DemoIDs.sam),
                .init(id: UUID(), name: "Jordan Lee", hours: 8, matchedCrewID: DemoIDs.jordan)
            ],
            note: "Stub read — no API key. Confirm before the week updates.",
            usedVisionAPI: false
        )
    }
}
