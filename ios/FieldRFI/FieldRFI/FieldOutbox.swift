import Foundation
import SwiftUI

/// Local handoff. Field documents here; the foreman enters Procore later.
/// Not a PO. Not a submitted RFI. No work_stopped.
enum FieldPacketKind: String, Codable, CaseIterable {
    case rfi
    case fieldProblem
    case materialAsk

    var title: String {
        switch self {
        case .rfi: return "RFI draft"
        case .fieldProblem: return "Field problem"
        case .materialAsk: return "Material ask"
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

    var isSent: Bool { sentAt != nil && status == "sent_to_foreman" }
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
}
