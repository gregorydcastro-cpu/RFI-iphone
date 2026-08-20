import Foundation
import SwiftUI

@MainActor
final class NewRFIViewModel: ObservableObject {
    @Published var baseURLString = APIClient.defaultBaseURL.absoluteString
    @Published var projects: [ProjectDTO] = []
    @Published var revisions: [SheetRevisionDTO] = []
    @Published var selectedProject: ProjectDTO?
    @Published var selectedRevision: SheetRevisionDTO?
    @Published var drawingData: Data?
    @Published var pin: PinDTO?
    @Published var gridLabel = ""
    @Published var note = ""
    @Published var photos: [PickedPhoto] = []
    @Published var isLoadingCatalog = false
    @Published var isDrafting = false
    @Published var errorMessage: String?
    @Published var duplicate: OpenRFIDTO?
    @Published var draftResult: DraftResultDTO?
    @Published var savedRFI: RFIDTO?

    var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    var canDraft: Bool {
        selectedProject != nil && selectedRevision != nil && !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isDrafting
    }

    func loadCatalog() async {
        isLoadingCatalog = true
        errorMessage = nil
        defer { isLoadingCatalog = false }
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
            errorMessage = error.localizedDescription
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
            if let current = selectedRevision, rows.contains(current) {
                await loadDrawing()
                return
            }
            selectedRevision = rows.first(where: { $0.sheet_number == "EL107_N" && $0.revision == "27" })
                ?? rows.first(where: { $0.sheet_number == "S301" && $0.revision == "C" })
                ?? rows.first
            await loadDrawing()
        } catch {
            errorMessage = error.localizedDescription
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
            errorMessage = error.localizedDescription
        }
    }

    func dropPin(xNorm: Double, yNorm: Double) {
        let label = gridLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        pin = PinDTO(x_norm: xNorm, y_norm: yNorm, label: label.isEmpty ? nil : label)
    }

    func addPhoto(_ photo: PickedPhoto) {
        photos.append(photo)
    }

    func removePhoto(_ photo: PickedPhoto) {
        photos.removeAll { $0.id == photo.id }
    }

    func draftRFI() async {
        guard let project = selectedProject, let revision = selectedRevision else { return }
        isDrafting = true
        errorMessage = nil
        duplicate = nil
        draftResult = nil
        savedRFI = nil
        defer { isDrafting = false }

        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        var workingPin = pin
        let label = gridLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        if var existing = workingPin {
            existing.label = label.isEmpty ? existing.label : label
            workingPin = existing
        }

        do {
            let search = try await client.searchRFIs(
                projectID: project.id,
                query: trimmed,
                sheetNumber: revision.sheet_number,
                grid: workingPin?.label
            )
            if let match = search.rfis.first {
                duplicate = match
                draftResult = DraftResultDTO(
                    ok: false,
                    rfi_id: match.id,
                    status: match.status,
                    rfi_display: match.rfi_display,
                    missing_for_submit: [],
                    message: "An open RFI already exists for this sheet, grid, or subject. Do not duplicate.",
                    duplicate: true
                )
                return
            }

            let envelope = PreflightEnvelope(
                task: "preflight_rfi",
                project: PreflightProject(id: project.id, name: project.name),
                sheet_revision: PreflightSheetRevision(
                    id: revision.id,
                    sheet_number: revision.sheet_number,
                    revision: revision.revision,
                    discipline: revision.discipline
                ),
                pin: workingPin,
                photos: photos.map {
                    PhotoDTO(
                        filename: $0.filename,
                        content_type: "image/jpeg",
                        data_base64: $0.jpegData.base64EncodedString()
                    )
                },
                open_rfis_same_sheet: [],
                user_note: trimmed
            )
            let result = try await client.createRFIDraft(envelope)
            draftResult = result
            if result.duplicate, let id = result.rfi_id {
                let found = try await client.rfi(id: id)
                duplicate = OpenRFIDTO(
                    id: found.id,
                    project_id: found.project_id,
                    status: found.status,
                    subject: found.subject,
                    question: found.question,
                    priority: found.priority,
                    rfi_display: found.rfi_display,
                    sheet_numbers: [revision.sheet_number],
                    grids: workingPin?.label.map { [$0] } ?? []
                )
            } else if result.ok, let id = result.rfi_id {
                savedRFI = try await client.rfi(id: id)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
