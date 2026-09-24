import SwiftData
import SwiftUI

struct ForemanHomeView: View {
    @Environment(SessionController.self) private var session
    @Query private var jobs: [Job]
    @Query private var sheets: [DrawingSheet]
    @Query(sort: \MaterialLine.createdAt, order: .reverse) private var materials: [MaterialLine]
    @Query(sort: \RFIPacket.createdAt, order: .reverse) private var rfis: [RFIPacket]
    @Query(sort: \FieldProblem.createdAt, order: .reverse) private var problems: [FieldProblem]
    @Query(sort: \JobTool.name) private var tools: [JobTool]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @State private var showAssign = false
    @State private var showBump = false

    private var job: Job? { jobs.first { $0.id == session.activeJobID } }
    private var current: DrawingSheet? { sheets.first { $0.job?.id == job?.id && $0.isCurrentSet } }
    private var old: DrawingSheet? { sheets.first { $0.job?.id == job?.id && !$0.isCurrentSet } }
    private var alerts: [ProcoreRevisionAlert] {
        guard let current, let old else { return [] }
        return StubProcoreReadService().currentSetAlerts(
            currentRevision: current.revision,
            previousRevision: old.revision,
            sheetName: current.displayName
        )
    }
    private var backorders: [MaterialLine] {
        materials.filter { $0.job?.id == job?.id && $0.status == .backordered }
    }
    private var me: CrewMember? { session.member(from: crew) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let alert = alerts.first {
                        Button {
                            session.activeSheetID = current?.id ?? session.activeSheetID
                            session.destination = .count
                            session.flash("On Rev \(alert.newRevision). Do not count Rev \(alert.oldRevision).")
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text(alert.message)
                                    .font(.headline)
                                    .multilineTextAlignment(.leading)
                            }
                            .foregroundStyle(.white)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(GCTheme.backorder, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }

                    if !backorders.isEmpty {
                        loudCard(
                            title: "Backordered",
                            symbol: "exclamationmark.octagon.fill",
                            text: backorders.map(\.itemDescription).joined(separator: ", ")
                        )
                    }

                    boardRow(
                        title: "RFI packets to file",
                        count: rfis.filter { $0.job?.id == job?.id && $0.status != .draft }.count,
                        symbol: "questionmark.bubble",
                        dest: .rfi,
                        note: "File them in Procore yourself. The app will not."
                    )
                    boardRow(
                        title: "Open problems",
                        count: problems.filter { $0.job?.id == job?.id && $0.status != .resolved }.count,
                        symbol: "exclamationmark.triangle",
                        dest: .problem,
                        note: "Field problems. Not tickets."
                    )
                    boardRow(
                        title: "Tools out",
                        count: tools.filter { $0.job?.id == job?.id && $0.holderName != nil }.count,
                        symbol: "wrench.and.screwdriver",
                        dest: .tools,
                        note: tools.filter { $0.holderName != nil }.map { "\($0.name) · \($0.holderName ?? "")" }.joined(separator: " · ")
                    )

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Today")
                            .font(.title3.weight(.bold))
                        Button {
                            showAssign = true
                        } label: {
                            Label("Morning assignment", systemImage: "sunrise.fill")
                        }
                        .buttonStyle(JobsiteButtonStyle())
                        .disabled(!(me?.role.canHandoffJob ?? false))

                        Button {
                            showBump = true
                        } label: {
                            Label("Bump a device", systemImage: "wave.3.right")
                        }
                        .buttonStyle(JobsiteButtonStyle(kind: .secondary))
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Text("Shared job iPad: you stay signed in. Crew PIN-switches to punch or grab a tool. Nobody gets your password.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Foreman")
            .sheet(isPresented: $showAssign) {
                MorningAssignmentView()
            }
            .sheet(isPresented: $showBump) {
                BumpComposerView()
            }
        }
    }

    private func loudCard(title: String, symbol: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(text).font(.subheadline)
            }
        }
        .foregroundStyle(.white)
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(GCTheme.backorder, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func boardRow(title: String, count: Int, symbol: String, dest: AppDestination, note: String) -> some View {
        Button {
            session.destination = dest
        } label: {
            HStack {
                Image(systemName: symbol)
                    .font(.title2)
                    .foregroundStyle(GCTheme.brand)
                    .frame(width: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline)
                    Text(note).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(count)")
                    .font(.title.weight(.bold).monospacedDigit())
                    .foregroundStyle(GCTheme.brandInk)
            }
            .padding()
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct MorningAssignmentView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(BumpService.self) private var bump
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @Query private var sheets: [DrawingSheet]
    @Query(sort: \JobTool.name) private var tools: [JobTool]
    @Query(sort: \MaterialLine.createdAt) private var materials: [MaterialLine]

    @State private var floor = "L2"
    @State private var selectedCrew: Set<UUID> = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Work") {
                    TextField("Floor", text: $floor)
                    LabeledContent("Sheet", value: sheets.first { $0.isCurrentSet }?.displayName ?? "—")
                    LabeledContent(
                        "Grab",
                        value: materials.filter { $0.status == .grabIt }.map(\.itemDescription).joined(separator: ", ")
                    )
                    LabeledContent(
                        "Tools free",
                        value: tools.filter { $0.availability == .available }.map(\.name).joined(separator: ", ")
                    )
                }
                Section("Bump to") {
                    ForEach(crew.filter { $0.role != .foreman }) { person in
                        Toggle(person.name, isOn: Binding(
                            get: { selectedCrew.contains(person.id) },
                            set: { on in
                                if on { selectedCrew.insert(person.id) } else { selectedCrew.remove(person.id) }
                            }
                        ))
                    }
                }
            }
            .navigationTitle("Morning assignment")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Bump") { send() }
                        .disabled(selectedCrew.isEmpty)
                }
            }
        }
    }

    private func send() {
        let sheet = sheets.first { $0.isCurrentSet }
        let grab = materials.filter { $0.status == .grabIt }.map { "\(Int($0.quantity)) \($0.itemDescription)" }.joined(separator: ", ")
        for person in crew where selectedCrew.contains(person.id) {
            let device = bump.nearby.first { $0.name.contains(person.shortName) } ?? bump.nearby[1]
            let payload = BumpPayload(
                kind: .morningAssignment,
                fromDevice: "Job iPad",
                fromCrew: session.member(from: crew)?.name ?? "Foreman",
                floor: floor,
                sheetName: sheet?.displayName,
                grabSummary: grab,
                toolNames: tools.filter { $0.availability == .available }.map(\.name),
                hours: nil,
                leftoverMaterial: nil,
                rfiTitles: [],
                problemTitles: [],
                notes: "Be on \(floor). Current set only.",
                includeCurrentSet: true,
                queuedBecauseOffline: false
            )
            bump.send(payload, to: device, context: modelContext)
        }
        try? modelContext.save()
        session.flash("Assignment bumped to the selected phones.")
        dismiss()
    }
}
