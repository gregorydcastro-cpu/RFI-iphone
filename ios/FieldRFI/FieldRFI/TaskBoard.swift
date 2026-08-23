import Foundation
import SwiftUI

/// On-device task assign + check-off. Not an RFI. No submit, number, close, or work_stopped.
enum FieldTaskStatus: String, Codable {
    case assigned
    case done

    var label: String {
        switch self {
        case .assigned: return "assigned"
        case .done: return "checked off"
        }
    }
}

struct FieldTask: Identifiable, Codable, Hashable {
    var id: String
    var jobID: String
    var jobName: String
    var title: String
    var note: String
    var assignedByUserID: String
    var assignedByName: String
    var assignedToUserID: String
    var assignedToName: String
    var status: FieldTaskStatus
    var createdAt: Date
    var doneAt: Date?
    var checkedOffByName: String?
}

@MainActor
final class TaskBoard: ObservableObject {
    static let shared = TaskBoard()

    @Published private(set) var tasks: [FieldTask] = []

    private let key = "gcfieldlog.tasks.v1"

    init() {
        load()
    }

    func assignedTo(_ userID: String) -> [FieldTask] {
        tasks.filter { $0.assignedToUserID == userID && $0.status == .assigned }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func assignedBy(_ userID: String) -> [FieldTask] {
        tasks.filter { $0.assignedByUserID == userID }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func task(id: String) -> FieldTask? {
        tasks.first(where: { $0.id == id })
    }

    @discardableResult
    func assign(
        title: String,
        note: String,
        from: CrewMemberDTO,
        to: CrewMemberDTO
    ) -> FieldTask? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, from.user_id != to.user_id else { return nil }
        var row = FieldTask(
            id: UUID().uuidString,
            jobID: ShopCrew.jobID,
            jobName: ShopCrew.jobName,
            title: trimmed,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            assignedByUserID: from.user_id,
            assignedByName: from.name,
            assignedToUserID: to.user_id,
            assignedToName: to.name,
            status: .assigned,
            createdAt: Date(),
            doneAt: nil,
            checkedOffByName: nil
        )
        tasks.insert(row, at: 0)
        save()
        _ = FieldOutbox.shared.sendToForeman(packet(for: row))
        return row
    }

    @discardableResult
    func checkOff(id: String, by: CrewMemberDTO) -> FieldTask? {
        guard let index = tasks.firstIndex(where: { $0.id == id }) else { return nil }
        guard tasks[index].assignedToUserID == by.user_id else { return nil }
        tasks[index].status = .done
        tasks[index].doneAt = Date()
        tasks[index].checkedOffByName = by.name
        save()
        _ = FieldOutbox.shared.sendToForeman(packet(for: tasks[index]))
        return tasks[index]
    }

    private func packet(for task: FieldTask) -> FieldPacket {
        let body: String
        if task.status == .done {
            body = "Checked off: \(task.title). \(task.checkedOffByName ?? task.assignedToName) marked it done."
        } else {
            body = task.note.isEmpty ? task.title : "\(task.title)\n\(task.note)"
        }
        return FieldPacket(
            id: task.id,
            kind: .task,
            projectID: task.jobID,
            projectName: task.jobName,
            sheetNumber: nil,
            revision: nil,
            sheetRevisionID: nil,
            pinLabel: nil,
            xNorm: nil,
            yNorm: nil,
            note: body,
            materialLines: [],
            photoCount: 0,
            createdByUserID: task.assignedByUserID,
            createdByName: task.assignedByName,
            createdByRole: "",
            sentToUserID: task.assignedToUserID,
            sentToName: task.assignedToName,
            createdAt: task.createdAt,
            sentAt: nil,
            rfiID: nil,
            status: "draft"
        )
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let rows = try? JSONDecoder().decode([FieldTask].self, from: data)
        else { return }
        tasks = rows
    }

    private func save() {
        if let data = try? JSONEncoder().encode(tasks) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }
}
