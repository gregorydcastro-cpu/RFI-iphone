import SwiftUI

/// In-app reminder: meetings in the next hour, and tasks due today for this seat.
/// No Apple Calendar. No push host.
struct MeetingSoonBanner: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var meetings = MeetingBoard.shared
    @ObservedObject private var tasks = TaskBoard.shared

    private let clock: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        let soon = meetings.soon(for: session.userID)
        let due = tasks.dueToday(for: session.userID)
        if soon.isEmpty && due.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 6) {
                if !soon.isEmpty {
                    Text("STARTING SOON")
                        .font(.caption.weight(.semibold))
                        .tracking(0.8)
                        .foregroundStyle(.white)
                    ForEach(soon) { row in
                        Text("\(clock.string(from: row.startsAt))  ·  \(row.withName)\(row.note.isEmpty ? "" : "  ·  \(row.note)")")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                    }
                }
                if !due.isEmpty {
                    Text("DUE TODAY")
                        .font(.caption.weight(.semibold))
                        .tracking(0.8)
                        .foregroundStyle(.white)
                    ForEach(due) { row in
                        Text("\(row.title)  ·  \(row.assignedToName)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldTheme.orange)
        }
    }
}

struct MeetingCalendarView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var board = MeetingBoard.shared
    @ObservedObject private var tasks = TaskBoard.shared
    @State private var startsAt = Date().addingTimeInterval(60 * 60)
    @State private var withID: String?
    @State private var note = ""
    @State private var message: String?
    @State private var day = Date()

    private let clock: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Meetings and dated tasks on \(ShopCrew.jobName). On this phone only. Not an RFI. No Apple Calendar sync. No Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                SampleJobPicker()

                VStack(alignment: .leading, spacing: 10) {
                    sectionLabel("On this day")
                    DatePicker("Day", selection: $day, displayedComponents: .date)
                    let dayMeetings = board.onDay(day)
                    let dayTasks = tasks.dueOn(day)
                    if dayMeetings.isEmpty && dayTasks.isEmpty {
                        Text("Nothing on this day.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    ForEach(dayMeetings) { row in
                        dayCard(
                            time: clock.string(from: row.startsAt),
                            title: "Meeting  ·  \(row.createdByName) with \(row.withName)",
                            detail: row.note
                        )
                    }
                    ForEach(dayTasks) { row in
                        dayCard(
                            time: "Due \(dayStamp.string(from: row.dueAt ?? day))",
                            title: "Task  ·  \(row.title)",
                            detail: "\(row.assignedByName) → \(row.assignedToName)  ·  \(row.status.label)"
                        )
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    sectionLabel("Set a meeting")
                    DatePicker("When", selection: $startsAt)
                    Menu {
                        ForEach(ShopCrew.members.filter { $0.user_id != me?.user_id }) { member in
                            Button {
                                withID = member.user_id
                            } label: {
                                Text("\(member.name)  ·  \(member.role.replacingOccurrences(of: "_", with: " "))")
                            }
                        }
                    } label: {
                        HStack {
                            Text(ShopCrew.members.first(where: { $0.user_id == withID })?.name ?? "With whom")
                                .foregroundStyle(FieldTheme.ink)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(FieldTheme.muted)
                        }
                        .padding(12)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                    }
                    TextField("Short note", text: $note)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        saveMeeting()
                    } label: {
                        Text("Save meeting")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(canSave ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(!canSave)
                }

                VStack(alignment: .leading, spacing: 10) {
                    sectionLabel("Upcoming")
                    if board.upcoming.isEmpty {
                        Text("No upcoming meetings on this phone.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    ForEach(board.upcoming) { row in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(clock.string(from: row.startsAt))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(FieldTheme.ink)
                            Text("\(row.createdByName) with \(row.withName)")
                                .font(.footnote)
                                .foregroundStyle(FieldTheme.muted)
                            if !row.note.isEmpty {
                                Text(row.note)
                                    .font(.footnote)
                                    .foregroundStyle(FieldTheme.ink)
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                    }
                }

                if let message {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Meetings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear { session.ensureShopSeat() }
    }

    private var me: CrewMemberDTO? {
        ShopCrew.members.first(where: { $0.user_id == session.userID })
            ?? ShopCrew.members.first
    }

    private let dayStamp: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    private func dayCard(time: String, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(time)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.ink)
            Text(title)
                .font(.footnote)
                .foregroundStyle(FieldTheme.muted)
            if !detail.isEmpty {
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.ink)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private var canSave: Bool {
        me != nil && withID != nil && withID != me?.user_id
    }

    private func saveMeeting() {
        guard let me, let withID,
              let other = ShopCrew.members.first(where: { $0.user_id == withID })
        else { return }
        _ = board.add(startsAt: startsAt, with: other, note: note, from: me)
        message = "Saved. Reminder shows on this phone in the hour before."
        note = ""
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
