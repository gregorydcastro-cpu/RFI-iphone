import Foundation
import SwiftUI

/// Shop tools on G-Line Shop Test. On this phone. No barcode. No Procore.
struct ShopTool: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var vendor: String
    var jobID: String
    var jobName: String
    var holderUserID: String?
    var holderName: String?
    var checkedOutAt: Date?
    var lostFlag: Bool? = nil

    var isLost: Bool { lostFlag == true }
    var isOut: Bool { holderUserID != nil && !isLost }
    var hasKnownHolder: Bool { holderUserID != nil && !isLost }
    /// Blast only when there is no person to open.
    var canBlastAllForemen: Bool { isLost || !hasKnownHolder }

    func matches(_ query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return true }
        return name.lowercased().contains(q)
            || vendor.lowercased().contains(q)
            || (holderName?.lowercased().contains(q) ?? false)
    }
}

@MainActor
final class ToolBoard: ObservableObject {
    static let shared = ToolBoard()

    @Published private(set) var tools: [ShopTool] = []

    private let key = "gcfieldlog.tools.v1"

    init() {
        load()
        if tools.isEmpty {
            tools = Self.seed
            save()
        }
    }

    func matching(_ query: String) -> [ShopTool] {
        tools.filter { $0.matches(query) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func tool(id: String) -> ShopTool? {
        tools.first(where: { $0.id == id })
    }

    func holder(of tool: ShopTool) -> CrewMemberDTO? {
        ShopCrew.member(byID: tool.holderUserID)
    }

    func heldBy(_ userID: String) -> [ShopTool] {
        tools.filter { $0.holderUserID == userID }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func checkOut(id: String, to member: CrewMemberDTO) {
        guard let index = tools.firstIndex(where: { $0.id == id }) else { return }
        tools[index].holderUserID = member.user_id
        tools[index].holderName = member.name
        tools[index].checkedOutAt = Date()
        tools[index].lostFlag = false
        save()
    }

    func checkIn(id: String) {
        guard let index = tools.firstIndex(where: { $0.id == id }) else { return }
        tools[index].holderUserID = nil
        tools[index].holderName = nil
        tools[index].checkedOutAt = nil
        tools[index].lostFlag = false
        save()
    }

    func markLost(id: String) {
        guard let index = tools.firstIndex(where: { $0.id == id }) else { return }
        tools[index].holderUserID = nil
        tools[index].holderName = nil
        tools[index].checkedOutAt = nil
        tools[index].lostFlag = true
        save()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let rows = try? JSONDecoder().decode([ShopTool].self, from: data)
        else { return }
        tools = rows
    }

    private func save() {
        if let data = try? JSONEncoder().encode(tools) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }

    private static let seed: [ShopTool] = [
        tool("emt-bender", "1/2\" EMT bender", "Greenlee"),
        tool("hole-saw", "Hole saw kit", "Milwaukee"),
        tool("multimeter", "Multimeter", "Fluke"),
        tool("knockout", "Knockout punch", "Greenlee"),
        tool("fish-tape", "Fish tape", "Klein"),
    ]

    private static func tool(_ id: String, _ name: String, _ vendor: String) -> ShopTool {
        ShopTool(
            id: id,
            name: name,
            vendor: vendor,
            jobID: ShopCrew.jobID,
            jobName: ShopCrew.jobName,
            holderUserID: nil,
            holderName: nil,
            checkedOutAt: nil,
            lostFlag: nil
        )
    }
}
