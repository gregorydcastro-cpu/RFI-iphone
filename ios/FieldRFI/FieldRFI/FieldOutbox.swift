import Foundation
import SwiftUI

/// Local handoff. Field documents here; the foreman enters Procore later.
/// Not a PO. Not a submitted RFI. No work_stopped.
enum FieldPacketKind: String, Codable, CaseIterable {
    case rfi
    case fieldProblem
    case materialAsk
    case printPhoto
    case task
    case groupMessage

    var title: String {
        switch self {
        case .rfi: return "RFI draft"
        case .fieldProblem: return "Field problem"
        case .materialAsk: return "Material list"
        case .printPhoto: return "Print / photo"
        case .task: return "Task"
        case .groupMessage: return "All Foremen"
        }
    }
}

struct FieldPacket: Identifiable, Codable, Hashable {
    var id: String
    var kind: FieldPacketKind
    var projectID: String
    var projectName: String
    var sheetNumber: String?
    var revision: String?
    var sheetRevisionID: String?
    var pinLabel: String?
    var xNorm: Double?
    var yNorm: Double?
    var note: String
    var materialLines: [DraftMaterialLineDTO]
    var photoCount: Int
    var createdByUserID: String
    var createdByName: String
    var createdByRole: String
    var sentToUserID: String
    var sentToName: String
    var createdAt: Date
    var sentAt: Date?
    var rfiID: String?
    var status: String
    var attachmentIDs: [String]? = nil
    var printCount: Int? = nil

    var isSent: Bool { sentAt != nil && status == "sent_to_foreman" }
    var attachedPrints: Int { printCount ?? 0 }
    var attachedIDs: [String] { attachmentIDs ?? [] }
}

@MainActor
final class FieldOutbox: ObservableObject {
    static let shared = FieldOutbox()

    @Published private(set) var packets: [FieldPacket] = []

    private let key = "fieldrfi.outbox.v1"

    init() {
        load()
    }

    func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let rows = try? JSONDecoder().decode([FieldPacket].self, from: data)
        else {
            packets = []
            return
        }
        packets = rows.sorted { $0.createdAt > $1.createdAt }
    }

    func save() {
        if let data = try? JSONEncoder().encode(packets) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    @discardableResult
    func sendToForeman(_ packet: FieldPacket) -> FieldPacket {
        var row = packet
        if row.kind != .task, row.kind != .groupMessage,
           !FeatureSettings.shared.maySend(from: row.createdByUserID, to: row.sentToUserID),
           let from = ShopCrew.member(byID: row.createdByUserID),
           let boss = ShopCrew.oneStepUp(from: from) {
            row.sentToUserID = boss.user_id
            row.sentToName = boss.name
        }
        row.sentAt = Date()
        row.status = "sent_to_foreman"
        if let index = packets.firstIndex(where: { $0.id == row.id }) {
            packets[index] = row
        } else {
            packets.insert(row, at: 0)
        }
        save()
        return row
    }

    func incoming(for userID: String) -> [FieldPacket] {
        let mine = packets.filter { $0.sentToUserID == userID && $0.isSent }
        if !mine.isEmpty { return mine }
        if userID == "local-field" || userID == "local-foreman" {
            return packets.filter { $0.isSent && ($0.sentToUserID == "local-foreman" || $0.sentToUserID == "local-field") }
        }
        return mine
    }

    func outgoing(for userID: String) -> [FieldPacket] {
        packets.filter { $0.createdByUserID == userID }
    }

    /// Same-phone v1: field and foreman share this device.
    func sentOnDevice() -> [FieldPacket] {
        packets.filter(\.isSent)
    }

    /// Optional all-hands to every Foreman seat. Not tool find. Does not rewrite to one-step-up.
    @discardableResult
    func sendGroupToForemen(note: String, from: CrewMemberDTO) -> [FieldPacket] {
        guard FeatureSettings.shared.mayGroupMessageForemen(from: from.user_id) else { return [] }
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return [] }
        let targets = ShopCrew.foremen.filter { $0.user_id != from.user_id }
        guard !targets.isEmpty else { return [] }
        var sent: [FieldPacket] = []
        let now = Date()
        for target in targets {
            let row = FieldPacket(
                id: UUID().uuidString,
                kind: .groupMessage,
                projectID: ShopCrew.jobID,
                projectName: ShopCrew.jobName,
                sheetNumber: nil,
                revision: nil,
                sheetRevisionID: nil,
                pinLabel: nil,
                xNorm: nil,
                yNorm: nil,
                note: text,
                materialLines: [],
                photoCount: 0,
                createdByUserID: from.user_id,
                createdByName: from.name,
                createdByRole: from.role,
                sentToUserID: target.user_id,
                sentToName: target.name,
                createdAt: now,
                sentAt: now,
                rfiID: nil,
                status: "sent_to_foreman"
            )
            packets.insert(row, at: 0)
            sent.append(row)
        }
        save()
        objectWillChange.send()
        return sent
    }
}
