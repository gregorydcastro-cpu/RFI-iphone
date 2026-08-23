import Foundation
import SwiftUI

@MainActor
final class FieldProblemViewModel: ObservableObject {
    @Published var baseURLString = APIClient.defaultBaseURLString
    @Published var projects: [ProjectDTO] = []
    @Published var revisions: [SheetRevisionDTO] = []
    @Published var selectedProject: ProjectDTO?
    @Published var selectedRevision: SheetRevisionDTO?
    @Published var drawingData: Data?
    @Published var pin: PinDTO?
    @Published var gridLabel = ""
    @Published var note = ""
    @Published var photos: [PickedPhoto] = []
    @Published var errorMessage: String?
    @Published var sentPacket: FieldPacket?

    var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    func canSend(session: FieldSession) -> Bool {
        session.sendTarget() != nil
            && !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (pin != nil || !photos.isEmpty)
    }

    func loadCatalog() async {
        errorMessage = nil
        if baseURLString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return
        }
        do {
            let rows = try await client.projects()
            projects = rows
            if selectedProject == nil {
                selectedProject = rows.first(where: { $0.name.contains("ILSB") })
                    ?? rows.first(where: { $0.name == "Harbor Yard Warehouse" })
                    ?? rows.first
            }
            await loadRevisions()
        } catch {
            if !APIClient.isMissingHost(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadRevisions() async {
        guard let project = selectedProject else {
            revisions = []
            selectedRevision = nil
            drawingData = nil
            return
        }
        do {
            let rows = try await client.sheetRevisions(projectID: project.id)
            revisions = rows
            selectedRevision = rows.first(where: { $0.sheet_number == "EL107_N" && $0.revision == "27" })
                ?? rows.first(where: { $0.is_current == true })
                ?? rows.first
            await loadDrawing()
        } catch {
            if !APIClient.isMissingHost(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadDrawing() async {
        guard let revision = selectedRevision else {
            drawingData = nil
            return
        }
        do {
            drawingData = try await client.drawing(revisionID: revision.id)
        } catch {
            drawingData = nil
        }
    }

    func dropPin(xNorm: Double, yNorm: Double) {
        let label = gridLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        pin = PinDTO(x_norm: xNorm, y_norm: yNorm, label: label.isEmpty ? nil : label)
    }

    func sendToForeman(session: FieldSession) {
        session.ensureLocalSeat()
        guard let target = session.sendTarget() else {
            errorMessage = "No foreman on this crew. Assign a seat that reports to a foreman."
            return
        }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let packet = FieldPacket(
            id: UUID().uuidString,
            kind: .fieldProblem,
            projectID: selectedProject?.id ?? "local-job",
            projectName: selectedProject?.name ?? "This job",
            sheetNumber: selectedRevision?.sheet_number,
            revision: selectedRevision?.revision,
            sheetRevisionID: selectedRevision?.id,
            pinLabel: pin?.label ?? (gridLabel.isEmpty ? nil : gridLabel),
            xNorm: pin?.x_norm,
            yNorm: pin?.y_norm,
            note: trimmed,
            materialLines: [],
            photoCount: photos.count,
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
