import SwiftUI
import UIKit

struct TaskAssignView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var board = TaskBoard.shared
    @ObservedObject private var features = FeatureSettings.shared
    @State private var title = ""
    @State private var note = ""
    @State private var assigneeID: String?
    @State private var hasDueDate = false
    @State private var dueAt = Date()
    @State private var message: String?
    @State private var error: String?
    @State private var proofByTask: [String: PickedPhoto] = [:]
    @State private var cameraTaskID: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Assign a task on \(ShopCrew.jobName). Assignee checks it off on this phone. Not an RFI. Not submitted. No work-stopped. No Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                ShopSeatPicker()

                if features.allowsAssign(session.userID) {
                    assignForm
                } else {
                    Text("The person above blocked assign for this seat. Check-off still works.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                }

                myTasks

                IAssigned

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
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
        .navigationTitle("Tasks")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear { session.ensureShopSeat() }
        .sheet(isPresented: Binding(
            get: { cameraTaskID != nil },
            set: { if !$0 { cameraTaskID = nil } }
        )) {
            CameraPicker { photo in
                if let id = cameraTaskID {
                    proofByTask[id] = photo
                }
                cameraTaskID = nil
            }
        }
    }

    private var me: CrewMemberDTO? {
        ShopCrew.members.first(where: { $0.user_id == session.userID })
            ?? ShopCrew.members.first
    }

    private var assignForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Assign")
            if assignTargets.isEmpty {
                Text("No one one step down. A GF can grant a named apprentice a direct line.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            TextField("Task", text: $title)
                .textFieldStyle(.roundedBorder)
            TextField("Note (optional)", text: $note)
                .textFieldStyle(.roundedBorder)
            Toggle("Due date (optional)", isOn: $hasDueDate)
            if hasDueDate {
                DatePicker("Due", selection: $dueAt, displayedComponents: .date)
            }
            sectionLabel("Crew on \(ShopCrew.jobName)")
            Text("Assign one step down on \(ShopCrew.jobName). Journeyman assigns to their paired apprentice. Skip-level only if the GF granted a direct line.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            ForEach(assignTargets) { member in
                Button {
                    assigneeID = member.user_id
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(member.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(FieldTheme.ink)
                            Text(member.role.replacingOccurrences(of: "_", with: " "))
                                .font(.caption)
                                .foregroundStyle(FieldTheme.muted)
                        }
                        Spacer()
                        if assigneeID == member.user_id {
                            Image(systemName: "checkmark")
                                .foregroundStyle(FieldTheme.orange)
                        }
                    }
                    .padding(12)
                    .background(assigneeID == member.user_id ? FieldTheme.orange.opacity(0.08) : Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                }
            }
            Button {
                assign()
            } label: {
                Text("Assign task")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(canAssign ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(!canAssign)
            Text("Lands in the Foreman inbox. Assignee marks it done here. Does not submit or number an RFI.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private var myTasks: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Assigned to me")
            let rows = session.userID.map { board.assignedTo($0) } ?? []
            if rows.isEmpty {
                Text("Nothing assigned to this seat.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(rows) { row in
                taskCard(row, showCheckOff: true)
            }
        }
    }

    private var IAssigned: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("I assigned — verification")
            let rows = session.userID.map { board.assignedBy($0) } ?? []
            if rows.isEmpty {
                Text("You have not assigned a task from this seat.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(rows) { row in
                taskCard(row, showCheckOff: false)
            }
        }
    }

    private func taskCard(_ row: FieldTask, showCheckOff: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(row.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.ink)
                Spacer()
                Text(row.status.label)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(row.status == .done
                                     ? Color(red: 0.16, green: 0.45, blue: 0.28)
                                     : FieldTheme.orange)
            }
            if !row.note.isEmpty {
                Text(row.note)
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            Text("\(row.assignedByName) → \(row.assignedToName)")
                .font(.caption2)
                .foregroundStyle(FieldTheme.muted)
            if let dueAt = row.dueAt {
                Text("Due \(dueDay.string(from: dueAt))")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(row.isDueToday && row.status == .assigned ? FieldTheme.orange : FieldTheme.muted)
            }
            if row.status == .done {
                Text("Verified: \(row.checkedOffByName ?? row.assignedToName) checked it off.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                if let image = board.proofImage(for: row) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(maxWidth: .infinity, minHeight: 120, maxHeight: 180)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            if showCheckOff, row.status == .assigned, let me {
                if let photo = proofByTask[row.id], let image = UIImage(data: photo.jpegData) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(maxWidth: .infinity, minHeight: 100, maxHeight: 140)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                Button("Add job photo") {
                    cameraTaskID = row.id
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.orange)
                Button("Mark done") {
                    let jpeg = proofByTask[row.id]?.jpegData
                    if board.checkOff(id: row.id, by: me, proofJPEG: jpeg) != nil {
                        message = jpeg == nil
                            ? "Checked off. Assigner can see the verification."
                            : "Checked off with proof photo. Assigner can see it."
                        error = nil
                        proofByTask[row.id] = nil
                    } else {
                        error = "Only the assignee can check this off."
                    }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.steel)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private var canAssign: Bool {
        features.allowsAssign(session.userID)
            && me != nil
            && assigneeID != nil
            && assigneeID != me?.user_id
            && assignTargets.contains(where: { $0.user_id == assigneeID })
            && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var assignTargets: [CrewMemberDTO] {
        features.assignTargets(for: session.userID)
    }

    private func assign() {
        guard let me, let assigneeID,
              let to = ShopCrew.members.first(where: { $0.user_id == assigneeID })
        else { return }
        if board.assign(title: title, note: note, from: me, to: to, dueAt: hasDueDate ? dueAt : nil) != nil {
            message = hasDueDate
                ? "Assigned to \(to.name). Shows on the calendar that day."
                : "Assigned to \(to.name). They check it off on this phone."
            error = nil
            title = ""
            note = ""
            hasDueDate = false
        } else {
            error = "Need a task and an assignee on \(ShopCrew.jobName)."
        }
    }

    private let dueDay: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
