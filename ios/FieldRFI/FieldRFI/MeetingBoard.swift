import Foundation
import SwiftUI

/// On-device meetings for G-Line Shop Test. Not an RFI. No Apple Calendar sync.
struct ShopMeeting: Identifiable, Codable, Hashable {
    var id: String
    var jobID: String
    var jobName: String
    var startsAt: Date
    var withUserID: String
    var withName: String
    var note: String
    var createdByUserID: String
    var createdByName: String
    var createdAt: Date

    var isUpcoming: Bool { startsAt >= Date().addingTimeInterval(-15 * 60) }

    var isSoon: Bool {
        let now = Date()
        return startsAt > now && startsAt <= now.addingTimeInterval(60 * 60)
    }
}

@MainActor
final class MeetingBoard: ObservableObject {
    static let shared = MeetingBoard()

    @Published private(set) var meetings: [ShopMeeting] = []

    private let key = "gcfieldlog.meetings.v1"

    init() {
        load()
    }

    var upcoming: [ShopMeeting] {
        meetings.filter(\.isUpcoming).sorted { $0.startsAt < $1.startsAt }
    }

    var soon: [ShopMeeting] {
        meetings.filter(\.isSoon).sorted { $0.startsAt < $1.startsAt }
    }

    @discardableResult
    func add(
        startsAt: Date,
        with: CrewMemberDTO,
        note: String,
        from: CrewMemberDTO
    ) -> ShopMeeting {
        let row = ShopMeeting(
            id: UUID().uuidString,
            jobID: ShopCrew.jobID,
            jobName: ShopCrew.jobName,
            startsAt: startsAt,
            withUserID: with.user_id,
            withName: with.name,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            createdByUserID: from.user_id,
            createdByName: from.name,
            createdAt: Date()
        )
        meetings.append(row)
        save()
        return row
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let rows = try? JSONDecoder().decode([ShopMeeting].self, from: data)
        else { return }
        meetings = rows
    }

    private func save() {
        if let data = try? JSONEncoder().encode(meetings) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }
}
