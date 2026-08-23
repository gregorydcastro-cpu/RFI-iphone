import Foundation
import SwiftUI

@MainActor
final class NewRFIViewModel: ObservableObject {
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
    @Published var isLoadingCatalog = false
    @Published var isDrafting = false
    @Published var errorMessage: String?
    @Published var duplicate: OpenRFIDTO?
    @Published var draftResult: DraftResultDTO?
    @Published var savedRFI: RFIDTO?
    @Published var tickets: [MaterialTicketDTO] = []
    @Published var submitResult: PESubmitResultDTO?
    @Published var isSubmitting = false
    @Published var sentToForemanName: String?

    var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    func canDraft(session: FieldSession) -> Bool {
        session.canDraftRFI
            && selectedProject != nil
            && selectedRevision != nil
            && !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isDrafting
    }

    func canShowSubmit(session: FieldSession) -> Bool {
        false
    }

    func canHumanSubmit(session: FieldSession) -> Bool {
        false
    }

    func canSendToForeman(session: FieldSession) -> Bool {
        FeatureSettings.shared.allowsSend(session.userID)
            && session.sendTarget() != nil
            && !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (pin != nil || !photos.isEmpty || savedRFI != nil)
            && !isSubmitting
    }

    func loadCatalog() async {
        isLoadingCatalog = true
        errorMessage = nil
        defer { isLoadingCatalog = false }
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
            if let current = selectedRevision, rows.contains(current) {
                await loadDrawing()
                return
            }
            selectedRevision = rows.first(where: { $0.sheet_number == "EL107_N" && $0.revision == "27" })
                ?? rows.first(where: { $0.sheet_number == "S301" && $0.revision == "C" })
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
            if !APIClient.isMissingHost(error) {
                errorMessage = error.localizedDescription
            }
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

    func loadTickets(session: FieldSession) async {
        guard let project = selectedProject, let userID = session.userID else {
            tickets = []
            return
        }
        tickets = (try? await client.fieldTickets(projectID: project.id, userID: userID).tickets) ?? []
    }

    func handleTicket(_ ticket: MaterialTicketDTO, session: FieldSession) async {
        do {
            _ = try await client.handleTicket(id: ticket.id, headers: session.fieldHeaders())
            await loadTickets(session: session)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func flagTicket(_ ticket: MaterialTicketDTO, session: FieldSession) async {
        do {
            try await client.flagTicket(
                id: ticket.id,
                note: "Missing / wrong / extra on \(ticket.summary)",
                kind: "missing",
                headers: session.fieldHeaders()
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func draftRFI(session: FieldSession) async {
        guard session.canDraftRFI, let actor = session.actorDTO() else {
            errorMessage = "This seat cannot draft an RFI."
            return
        }
        guard let project = selectedProject, let revision = selectedRevision else { return }
        isDrafting = true
        errorMessage = nil
        duplicate = nil
        draftResult = nil
        savedRFI = nil
        sentToForemanName = nil
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
                user_note: trimmed,
                actor: actor
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
                submitResult = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func submitDraft(session: FieldSession) async {
        errorMessage = "Field v1 does not submit or set work-stopped. Send the draft to the foreman."
    }

    func sendToForeman(session: FieldSession) {
        session.ensureLocalSeat()
        guard FeatureSettings.shared.allowsSend(session.userID) else {
            errorMessage = "The person above blocked send-to-inbox for this seat."
            return
        }
        guard let target = session.sendTarget() else {
            errorMessage = "No foreman on this crew."
            return
        }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let packet = FieldPacket(
            id: UUID().uuidString,
            kind: .rfi,
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
            rfiID: savedRFI?.id,
            status: "draft"
        )
        _ = FieldOutbox.shared.sendToForeman(packet)
        submitResult = nil
        errorMessage = nil
        sentToForemanName = target.name
    }
}
