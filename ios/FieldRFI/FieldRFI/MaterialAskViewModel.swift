import Foundation
import SwiftUI

@MainActor
final class MaterialAskViewModel: ObservableObject {
    @Published var baseURLString = APIClient.defaultBaseURL.absoluteString
    @Published var projects: [ProjectDTO] = []
    @Published var selectedProject: ProjectDTO?
    @Published var note = ""
    @Published var lines: [DraftMaterialLineDTO] = [
        DraftMaterialLineDTO(description: "", qty: 1, uom: "EA")
    ]
    @Published var errorMessage: String?
    @Published var sentPacket: FieldPacket?

    let uoms = ["EA", "LF", "SF", "BOX", "SET"]

    var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    var readyLines: [DraftMaterialLineDTO] {
        lines.compactMap { line in
            let desc = line.description.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !desc.isEmpty, line.qty > 0, uoms.contains(line.uom) else { return nil }
            return DraftMaterialLineDTO(description: desc, qty: line.qty, uom: line.uom)
        }
    }

    func canSend(session: FieldSession) -> Bool {
        session.sendTarget() != nil && selectedProject != nil && !readyLines.isEmpty
    }

    func addLine() {
        lines.append(DraftMaterialLineDTO(description: "", qty: 1, uom: "EA"))
    }

    func removeLine(at index: Int) {
        guard lines.indices.contains(index) else { return }
        lines.remove(at: index)
        if lines.isEmpty {
            addLine()
        }
    }

    func loadCatalog() async {
        errorMessage = nil
        do {
            let rows = try await client.projects()
            projects = rows
            if selectedProject == nil {
                selectedProject = rows.first(where: { $0.name.contains("ILSB") })
                    ?? rows.first
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendToForeman(session: FieldSession) {
        guard let project = selectedProject, let target = session.sendTarget() else {
            errorMessage = "No foreman on this crew."
            return
        }
        let ready = readyLines
        guard !ready.isEmpty else {
            errorMessage = "Add at least one line: description, qty, and UOM."
            return
        }
        let packet = FieldPacket(
            id: UUID().uuidString,
            kind: .materialAsk,
            projectID: project.id,
            projectName: project.name,
            sheetNumber: nil,
            revision: nil,
            sheetRevisionID: nil,
            pinLabel: nil,
            xNorm: nil,
            yNorm: nil,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            materialLines: ready,
            photoCount: 0,
            createdByUserID: session.userID ?? "",
            createdByName: session.assignment?.name ?? "Field",
            createdByRole: session.role,
            sentToUserID: target.id,
            sentToName: target.name,
            createdAt: Date(),
            sentAt: nil,
            rfiID: nil,
            status: "draft"
        )
        sentPacket = FieldOutbox.shared.sendToForeman(packet)
        errorMessage = nil
    }
}
