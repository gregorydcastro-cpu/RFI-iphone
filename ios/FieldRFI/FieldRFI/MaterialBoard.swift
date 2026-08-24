import Foundation
import SwiftUI

/// First-class material list. Held on this phone, sent to the foreman.
/// Not a PO. Not submitted. No Procore. No work_stopped.
enum MaterialListStatus: String, Codable, CaseIterable {
    case held
    case sent
    case picked
    case backOrdered = "back_ordered"

    var label: String {
        switch self {
        case .held: return "held"
        case .sent: return "sent"
        case .picked: return "picked"
        case .backOrdered: return "back-ordered"
        }
    }
}

struct MaterialLine: Identifiable, Codable, Hashable {
    var id: String
    var description: String
    var qty: Double
    var uom: String

    static func blank() -> MaterialLine {
        MaterialLine(id: UUID().uuidString, description: "", qty: 1, uom: "EA")
    }

    func asDTO() -> DraftMaterialLineDTO {
        DraftMaterialLineDTO(
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            qty: qty,
            uom: uom
        )
    }
}

struct MaterialListRecord: Identifiable, Codable, Hashable {
    var id: String
    var jobID: String
    var jobName: String
    var note: String
    var lines: [MaterialLine]
    var status: MaterialListStatus
    var createdByUserID: String
    var createdByName: String
    var sentToUserID: String?
    var sentToName: String?
    var createdAt: Date
    var updatedAt: Date
    var sentAt: Date?
    var flagNote: String?
    var assignedToUserID: String?
    var assignedToName: String?
    var handledAt: Date?

    static let shopTestID = "g-line-shop-test"
    static let shopTestName = "G-Line Shop Test"

    var readyLines: [MaterialLine] {
        lines.filter {
            !$0.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                && $0.qty > 0
                && MaterialBoard.uoms.contains($0.uom)
        }
    }

    static func newHeld(userID: String, name: String, job: SampleJob = ShopSampleCatalog.selected) -> MaterialListRecord {
        MaterialListRecord(
            id: UUID().uuidString,
            jobID: job.id,
            jobName: job.name,
            note: "",
            lines: [MaterialLine.blank()],
            status: .held,
            createdByUserID: userID,
            createdByName: name,
            sentToUserID: nil,
            sentToName: nil,
            createdAt: Date(),
            updatedAt: Date(),
            sentAt: nil,
            flagNote: nil,
            assignedToUserID: nil,
            assignedToName: nil,
            handledAt: nil
        )
    }
}

@MainActor
final class MaterialBoard: ObservableObject {
    static let shared = MaterialBoard()
    static let uoms = ["EA", "LF", "SF", "BOX", "SET"]

    @Published var held: MaterialListRecord
    @Published private(set) var lists: [MaterialListRecord] = []

    private let key = "gcfieldlog.material.v1"

    init() {
        held = MaterialListRecord.newHeld(userID: "local-field", name: "Field")
        load()
    }

    var history: [MaterialListRecord] {
        lists.sorted { $0.updatedAt > $1.updatedAt }
    }

    func history(for jobID: String) -> [MaterialListRecord] {
        lists.filter { $0.jobID == jobID }.sorted { $0.updatedAt > $1.updatedAt }
    }

    func assignedTickets(for session: FieldSession) -> [MaterialListRecord] {
        let open = history(for: session.selectedJobID).filter { $0.status == .sent || $0.status == .backOrdered }
        if session.isApprentice, let me = session.userID {
            return open.filter { $0.assignedToUserID == me }
        }
        if session.role == "journeyman",
           let apprentice = FeatureSettings.shared.pairedApprentice(ofJourneyman: session.userID) {
            return open.filter {
                $0.assignedToUserID == apprentice.user_id || $0.assignedToUserID == session.userID
            }
        }
        return open
    }

    var pickedTickets: [MaterialListRecord] {
        history.filter { $0.status == .picked }
    }

    func pickedTickets(for jobID: String) -> [MaterialListRecord] {
        history(for: jobID).filter { $0.status == .picked }
    }

    func statusCounts(for jobID: String? = nil) -> [(MaterialListStatus, Int)] {
        let jobHeld = jobID == nil || held.jobID == jobID
        let heldCount = jobHeld && !held.readyLines.isEmpty ? 1 : 0
        let rows = jobID.map { id in lists.filter { $0.jobID == id } } ?? lists
        return [
            (.held, heldCount),
            (.sent, rows.filter { $0.status == .sent }.count),
            (.picked, rows.filter { $0.status == .picked }.count),
            (.backOrdered, rows.filter { $0.status == .backOrdered }.count),
        ]
    }

    func status(forListID id: String) -> MaterialListStatus? {
        if held.id == id { return held.status }
        return lists.first(where: { $0.id == id })?.status
    }

    func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let box = try? JSONDecoder().decode(Box.self, from: data)
        else {
            return
        }
        held = box.held
        lists = box.lists
    }

    func save() {
        let box = Box(held: held, lists: lists)
        if let data = try? JSONEncoder().encode(box) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    func adoptSelectedJob() {
        let job = ShopSampleCatalog.selected
        if held.readyLines.isEmpty {
            held.jobID = job.id
            held.jobName = job.name
            save()
        }
    }

    @discardableResult
    func applyTakeoff(_ lines: [MaterialLine], note: String, job: SampleJob = ShopSampleCatalog.selected) -> Bool {
        guard !lines.isEmpty else { return false }
        held.jobID = job.id
        held.jobName = job.name
        held.lines.removeAll {
            $0.description.contains("E-101 Rev A takeoff")
                || $0.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        held.lines.append(contentsOf: lines)
        if held.note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            held.note = note
        }
        held.updatedAt = Date()
        save()
        objectWillChange.send()
        return true
    }

    func addLine() {
        held.lines.append(MaterialLine.blank())
        held.updatedAt = Date()
        save()
    }

    func removeLine(id: String) {
        held.lines.removeAll { $0.id == id }
        if held.lines.isEmpty {
            held.lines = [MaterialLine.blank()]
        }
        held.updatedAt = Date()
        save()
    }

    func ensureAuthor(session: FieldSession) {
        session.ensureLocalSeat()
        if held.createdByUserID.isEmpty || held.createdByUserID == "local-field" {
            held.createdByUserID = session.userID ?? "local-field"
            held.createdByName = session.assignment?.name ?? "Field"
        }
        if held.jobName.isEmpty {
            held.jobID = ShopSampleCatalog.selected.id
            held.jobName = ShopSampleCatalog.selected.name
        }
        adoptSelectedJob()
        save()
    }

    @discardableResult
    func sendHeld(session: FieldSession) -> FieldPacket? {
        session.ensureLocalSeat()
        guard let target = session.sendTarget() else { return nil }
        let ready = held.readyLines
        guard !ready.isEmpty else { return nil }

        held.lines = ready
        held.status = .sent
        held.sentAt = Date()
        held.sentToUserID = target.id
        held.sentToName = target.name
        held.createdByUserID = session.userID ?? held.createdByUserID
        held.createdByName = session.assignment?.name ?? held.createdByName
        if let apprentice = FeatureSettings.shared.pickupAssignee(for: session.userID) {
            held.assignedToUserID = apprentice.user_id
            held.assignedToName = apprentice.name
        } else {
            held.assignedToUserID = "local-pickup"
            held.assignedToName = "Pickup"
        }
        held.updatedAt = Date()
        let sent = held
        lists.insert(sent, at: 0)
        let packet = packet(for: sent, extraNote: nil)
        held = MaterialListRecord.newHeld(
            userID: session.userID ?? "local-field",
            name: session.assignment?.name ?? "Field",
            job: ShopSampleCatalog.selected
        )
        save()
        return FieldOutbox.shared.sendToForeman(packet)
    }

    @discardableResult
    func flagBackOrder(id: String, note: String, session: FieldSession) -> Bool {
        session.ensureLocalSeat()
        guard let index = lists.firstIndex(where: { $0.id == id }) else { return false }
        var row = lists[index]
        row.status = .backOrdered
        row.flagNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        row.updatedAt = Date()
        if FeatureSettings.shared.allowsSend(session.userID), let target = session.sendTarget() {
            row.sentToUserID = target.id
            row.sentToName = target.name
        }
        lists[index] = row
        save()
        if FeatureSettings.shared.allowsSend(session.userID), session.sendTarget() != nil {
            let extra = row.flagNote?.isEmpty == false ? "Back-order: \(row.flagNote!)" : "Back-order"
            _ = FieldOutbox.shared.sendToForeman(packet(for: row, extraNote: extra))
        }
        return true
    }

    func markPicked(id: String) {
        guard let index = lists.firstIndex(where: { $0.id == id }) else { return }
        lists[index].status = .picked
        lists[index].handledAt = Date()
        lists[index].updatedAt = Date()
        save()
    }

    private func packet(for list: MaterialListRecord, extraNote: String?) -> FieldPacket {
        let body: String
        if let extraNote, !extraNote.isEmpty {
            body = list.note.isEmpty ? extraNote : "\(extraNote)\n\(list.note)"
        } else {
            body = list.note
        }
        return FieldPacket(
            id: extraNote == nil ? list.id : UUID().uuidString,
            kind: .materialAsk,
            projectID: list.jobID,
            projectName: list.jobName,
            sheetNumber: nil,
            revision: nil,
            sheetRevisionID: nil,
            pinLabel: nil,
            xNorm: nil,
            yNorm: nil,
            note: body,
            materialLines: list.readyLines.map { $0.asDTO() },
            photoCount: 0,
            createdByUserID: list.createdByUserID,
            createdByName: list.createdByName,
            createdByRole: "",
            sentToUserID: list.sentToUserID ?? "",
            sentToName: list.sentToName ?? "Foreman",
            createdAt: list.createdAt,
            sentAt: nil,
            rfiID: nil,
            status: "draft"
        )
    }

    private struct Box: Codable {
        var held: MaterialListRecord
        var lists: [MaterialListRecord]
    }
}
