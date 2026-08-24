import Foundation
import SwiftUI

@MainActor
final class GCImpactViewModel: ObservableObject {
    let rfiID: String
    @Published var rfi: RFIDTO?
    @Published var isLoading = false
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var banner: String?

    @Published var coTitle = ""
    @Published var coCost = ""
    @Published var coDays = ""
    @Published var coNotes = ""

    @Published var lineDescription = ""
    @Published var lineQty = "1"
    @Published var lineUom = "EA"
    @Published var materialLines: [DraftMaterialLineDTO] = []

    static let disclaimer = "An answer is not a change order and does not authorize work."
    static let uoms = ["EA", "LF", "SF", "BOX", "SET"]

    init(rfiID: String) {
        self.rfiID = rfiID
    }

    private var client: APIClient {
        APIClient(baseURL: APIClient.defaultBaseURL)
    }

    var canStartImpact: Bool {
        rfi?.status == "answered" && !isWorking && rfi?.closed_at == nil
    }

    var canDraft: Bool {
        guard let rfi, !isWorking else { return false }
        return ["answered", "impact_review"].contains(rfi.status)
            && !(rfi.official_response ?? "").isEmpty
    }

    var canClose: Bool {
        canDraft && rfi?.status != "draft" && rfi?.status != "void"
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            rfi = try await client.rfi(id: rfiID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startImpact() async {
        guard canStartImpact else { return }
        await run {
            _ = try await client.gcStartImpactReview(rfiID: rfiID)
            banner = "Impact review started."
        }
    }

    func saveChangeOrder() async {
        let title = coTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canDraft, !title.isEmpty else { return }
        let cost = Double(coCost.trimmingCharacters(in: .whitespacesAndNewlines))
        let days = Int(coDays.trimmingCharacters(in: .whitespacesAndNewlines))
        await run {
            let result = try await client.gcDraftChangeOrder(
                rfiID: rfiID,
                body: GCDraftChangeOrderBody(
                    title: title,
                    cost_amount: cost,
                    schedule_days: days,
                    notes: coNotes.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            banner = result.message
            coTitle = ""
            coCost = ""
            coDays = ""
            coNotes = ""
        }
    }

    func addMaterialLine() {
        let description = lineDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let qty = Double(lineQty.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        guard !description.isEmpty, qty > 0 else { return }
        materialLines.append(DraftMaterialLineDTO(description: description, qty: qty, uom: lineUom))
        lineDescription = ""
        lineQty = "1"
    }

    func removeMaterialLine(_ line: DraftMaterialLineDTO) {
        materialLines.removeAll { $0.description == line.description && $0.qty == line.qty && $0.uom == line.uom }
    }

    func saveMaterialOrder() async {
        guard canDraft, !materialLines.isEmpty else { return }
        await run {
            let result = try await client.gcDraftMaterialOrder(
                rfiID: rfiID,
                body: GCDraftMaterialOrderBody(lines: materialLines)
            )
            banner = result.message
            materialLines = []
        }
    }

    func closeRFI() async {
        guard canClose else { return }
        await run {
            let result = try await client.gcClose(rfiID: rfiID)
            banner = result.message
        }
    }

    private func run(_ work: () async throws -> Void) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await work()
            rfi = try await client.rfi(id: rfiID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
