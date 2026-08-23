import SwiftUI

struct MeetingCalendarView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var board = MeetingBoard.shared
    @State private var startsAt = Date().addingTimeInterval(60 * 60)
    @State private var withID: String?
    @State private var note = ""
    @State private var message: String?

    private let clock: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Meetings on \(ShopCrew.jobName). On this phone only. Not an RFI. No Apple Calendar sync. No Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                if !board.soon.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("STARTING SOON")
                            .font(.caption.weight(.semibold))
                            .tracking(0.8)
                            .foregroundStyle(FieldTheme.orange)
                        ForEach(board.soon) { row in
                            Text("\(clock.string(from: row.startsAt))  ·  \(row.withName)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(FieldTheme.ink)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(FieldTheme.orange.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
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

    private var canSave: Bool {
        me != nil && withID != nil && withID != me?.user_id
    }

    private func saveMeeting() {
        guard let me, let withID,
              let other = ShopCrew.members.first(where: { $0.user_id == withID })
        else { return }
        _ = board.add(startsAt: startsAt, with: other, note: note, from: me)
        message = "Saved. Reminder shows here in the hour before."
        note = ""
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
