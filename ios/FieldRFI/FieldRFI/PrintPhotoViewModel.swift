import Foundation
import SwiftUI

struct PendingPrint: Identifiable, Hashable {
    let id: String
    let filename: String
    let data: Data
}

@MainActor
final class PrintPhotoViewModel: ObservableObject {
    @Published var note = ""
    @Published var photos: [PickedPhoto] = []
    @Published var prints: [PendingPrint] = []
    @Published var errorMessage: String?
    @Published var sentPacket: FieldPacket?
    @Published var takeoffMessage: String?

    var jobName: String { ShopSampleCatalog.selected.name }
    var jobID: String { ShopSampleCatalog.selected.id }

    func canSend(session: FieldSession) -> Bool {
        FeatureSettings.shared.allowsSend(session.userID)
            && session.sendTarget() != nil
            && (!photos.isEmpty || !prints.isEmpty)
    }

    func runTakeoff() {
        switch GrokTakeoff.run(job: ShopSampleCatalog.selected) {
        case .success(let result):
            if MaterialBoard.shared.applyTakeoff(result.lines, note: result.message) {
                takeoffMessage = result.message
                errorMessage = nil
            } else {
                errorMessage = "Takeoff did not write quantities."
            }
        case .failure(let failure):
            takeoffMessage = nil
            errorMessage = failure.message
        }
    }

    func addPrint(filename: String, data: Data) {
        prints.append(PendingPrint(id: UUID().uuidString, filename: filename, data: data))
    }

    func removePrint(id: String) {
        prints.removeAll { $0.id == id }
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
        guard !photos.isEmpty || !prints.isEmpty else {
            errorMessage = "Add a print PDF or a job picture."
            return
        }
        let packetID = UUID().uuidString
        var ids: [String] = []
        for print in prints {
            let saved = FieldAttachmentStore.shared.save(
                packetID: packetID,
                kind: .pdf,
                filename: print.filename,
                data: print.data
            )
            ids.append(saved.id)
        }
        for photo in photos {
            let saved = FieldAttachmentStore.shared.save(
                packetID: packetID,
                kind: .jpeg,
                filename: photo.filename,
                data: photo.jpegData
            )
            ids.append(saved.id)
        }
        let packet = FieldPacket(
            id: packetID,
            kind: .printPhoto,
            projectID: jobID,
            projectName: jobName,
            sheetNumber: nil,
            revision: nil,
            sheetRevisionID: nil,
            pinLabel: nil,
            xNorm: nil,
            yNorm: nil,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
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
            status: "draft",
            attachmentIDs: ids,
            printCount: prints.count
        )
        sentPacket = FieldOutbox.shared.sendToForeman(packet)
        errorMessage = nil
        prints = []
        photos = []
        note = ""
    }
}
