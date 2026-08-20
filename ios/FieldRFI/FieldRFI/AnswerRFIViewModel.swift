import Foundation
import SwiftUI

@MainActor
final class AnswerRFIViewModel: ObservableObject {
    let rfiID: String
    @Published var baseURLString = APIClient.defaultBaseURL.absoluteString
    @Published var rfi: RFIDTO?
    @Published var responseText = ""
    @Published var wantsClarification = false
    @Published var isLoading = false
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var actionResult: DesignActionResultDTO?

    static let disclaimer = "An answer is not a change order and does not authorize work."

    init(rfiID: String) {
        self.rfiID = rfiID
    }

    private var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    var canAnswer: Bool {
        guard let rfi, actionResult == nil, !isWorking else { return false }
        let waiting = ["submitted", "ball_in_court"].contains(rfi.status)
        let text = responseText.trimmingCharacters(in: .whitespacesAndNewlines)
        return waiting && !text.isEmpty
    }

    var canStartImpact: Bool {
        guard let rfi, !isWorking else { return false }
        return rfi.status == "answered" && !(rfi.official_response ?? "").isEmpty
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            rfi = try await client.rfi(id: rfiID)
            if responseText.isEmpty, let existing = rfi?.official_response, !existing.isEmpty {
                responseText = existing
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func submitAnswer() async {
        guard canAnswer else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        let text = responseText.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            if wantsClarification {
                actionResult = try await client.designRequestClarification(rfiID: rfiID, note: text)
            } else {
                actionResult = try await client.designOfficialResponse(rfiID: rfiID, text: text)
            }
            rfi = try await client.rfi(id: rfiID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startImpactReview() async {
        guard canStartImpact else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            actionResult = try await client.gcStartImpactReview(rfiID: rfiID)
            rfi = try await client.rfi(id: rfiID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
