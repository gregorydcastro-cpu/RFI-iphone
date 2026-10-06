import SwiftData
import SwiftUI

struct TimeWeekView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TimeEntry.day) private var entries: [TimeEntry]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    @State private var showSignIn = false
    @State private var punchHours: Double = 8

    private var jobEntries: [TimeEntry] {
        entries.filter { $0.job?.id == session.activeJobID }
    }
    private var me: CrewMember? { session.member(from: crew) }
    private var days: [Date] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        return (-6...0).compactMap { cal.date(byAdding: .day, value: $0, to: today) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("This week") {
                    ForEach(crew) { person in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(person.name).font(.headline)
                            HStack(spacing: 6) {
                                ForEach(days, id: \.self) { day in
                                    let hours = jobEntries.first { $0.workerID == person.id && Calendar.current.isDate($0.day, inSameDayAs: day) }?.hours
                                    DayCell(day: day, hours: hours)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                if me != nil {
                    Section("Punch") {
                        Stepper("Hours today: \(punchHours, specifier: "%.1f")", value: $punchHours, in: 0.5...16, step: 0.5)
                        Button("Punch \(me?.shortName ?? "")") {
                            punch()
                        }
                        .buttonStyle(JobsiteButtonStyle())
                    }
                }
            }
            .navigationTitle("Time")
            .toolbar {
                if me?.role.canFixTime == true {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Sign-in sheet") { showSignIn = true }
                    }
                }
            }
            .sheet(isPresented: $showSignIn) {
                SignInSheetView()
            }
        }
    }

    private func punch() {
        guard let me, let job = try? modelContext.fetch(FetchDescriptor<Job>()).first(where: { $0.id == session.activeJobID }) else { return }
        let today = Calendar.current.startOfDay(for: .now)
        if let existing = jobEntries.first(where: { $0.workerID == me.id && Calendar.current.isDate($0.day, inSameDayAs: today) }) {
            existing.hours = punchHours
            existing.source = .punch
        } else {
            let entry = TimeEntry(workerName: me.name, workerID: me.id, day: today, hours: punchHours, source: .punch)
            entry.job = job
            modelContext.insert(entry)
        }
        try? modelContext.save()
        session.flash(String(format: "Punched %.1f hrs.", punchHours))
        if session.isPINSession, let host = session.signedIn(from: crew) {
            session.endPINSession(returningTo: host.name)
        }
    }
}

struct DayCell: View {
    let day: Date
    let hours: Double?

    var body: some View {
        VStack(spacing: 4) {
            Text(day, format: .dateTime.weekday(.narrow))
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(hours.map { $0 == $0.rounded() ? "\(Int($0))" : String(format: "%.1f", $0) } ?? "·")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle((hours ?? 0) > 8 ? GCTheme.overtime : Color.primary)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 36)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .accessibilityLabel(label)
    }

    private var label: String {
        let name = day.formatted(.dateTime.weekday(.wide))
        guard let hours else { return "\(name), no hours" }
        let ot = hours > 8 ? ", overtime" : ""
        return "\(name), \(hours) hours\(ot)"
    }
}

struct SignInSheetView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(SessionController.self) private var session
    @Query private var jobs: [Job]
    @State private var draft: SignInDraft?
    @State private var reading = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Snap the paper sheet. Grok reads names and hours. You confirm. The week updates. Copy goes to the GF.")
                        .font(.subheadline)
                }
                if let draft {
                    Section("Confirm") {
                        ForEach(draft.rows) { row in
                            HStack {
                                Text(row.name)
                                Spacer()
                                Text("\(row.hours, specifier: "%.1f")")
                                    .foregroundStyle(row.hours > 8 ? GCTheme.overtime : Color.primary)
                                    .fontWeight(.bold)
                            }
                        }
                        Text(draft.note).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Paper sign-in")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button(draft == nil ? "Snap (demo read)" : "Confirm week") {
                        Task { await go() }
                    }
                    .disabled(reading)
                }
            }
        }
    }

    private func go() async {
        if draft == nil {
            reading = true
            draft = await StubSignInSheetService().read(imagePNG: nil)
            reading = false
            return
        }
        guard let draft, let job = jobs.first(where: { $0.id == session.activeJobID }) else { return }
        let today = Calendar.current.startOfDay(for: .now)
        for row in draft.rows {
            guard let id = row.matchedCrewID else { continue }
            if let existing = (try? modelContext.fetch(FetchDescriptor<TimeEntry>()))?.first(where: {
                $0.workerID == id && Calendar.current.isDate($0.day, inSameDayAs: today) && $0.job?.id == job.id
            }) {
                existing.hours = row.hours
                existing.source = .signInSheet
            } else {
                let entry = TimeEntry(workerName: row.name, workerID: id, day: today, hours: row.hours, source: .signInSheet)
                entry.job = job
                modelContext.insert(entry)
            }
        }
        try? modelContext.save()
        session.flash("Week updated from the sheet. Copy noted for the GF.")
        dismiss()
    }
}
