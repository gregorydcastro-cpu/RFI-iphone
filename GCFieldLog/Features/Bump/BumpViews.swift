import SwiftData
import SwiftUI

struct BumpComposerView: View {
    @Environment(SessionController.self) private var session
    @Environment(BumpService.self) private var bump
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @Query private var sheets: [DrawingSheet]
    @Query(sort: \RFIPacket.createdAt, order: .reverse) private var rfis: [RFIPacket]
    @Query(sort: \FieldProblem.createdAt, order: .reverse) private var problems: [FieldProblem]
    @Query(sort: \JobTool.name) private var tools: [JobTool]
    @Query(sort: \MaterialLine.createdAt) private var materials: [MaterialLine]
    @Query(sort: \AsBuiltMark.createdAt, order: .reverse) private var redlines: [AsBuiltMark]
    @Query(sort: \BumpRecord.createdAt, order: .reverse) private var records: [BumpRecord]

    @State private var kind: BumpKind = .endOfDayDump
    @State private var deviceID: String = "ipad-job"
    @State private var hours: Double = 8
    @State private var leftover = "Half box of EMT connectors still in the gang box."
    @State private var notes = ""

    private var me: CrewMember? { session.member(from: crew) }
    private var device: NearbyDevice? { bump.nearby.first { $0.id == deviceID } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Kind") {
                    Picker("Bump", selection: $kind) {
                        ForEach(BumpKind.allCases) { item in
                            Label(item.title, systemImage: item.symbol).tag(item)
                        }
                    }
                    Text(kind.detail)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Nearby (app peers, not AirDrop)") {
                    Picker("Device", selection: $deviceID) {
                        ForEach(bump.nearby) { item in
                            Text("\(item.name) · \(item.kind)").tag(item.id)
                        }
                    }
                    Toggle("Basement / no signal — queue", isOn: Binding(
                        get: { bump.basementMode },
                        set: { bump.basementMode = $0 }
                    ))
                }
                if kind == .endOfDayDump {
                    Section("Dump") {
                        Stepper("Hours \(hours, specifier: "%.1f")", value: $hours, in: 0...16, step: 0.5)
                        TextField("Leftover material", text: $leftover, axis: .vertical)
                    }
                }
                Section("Note") {
                    TextField("Optional", text: $notes, axis: .vertical)
                }
                Section("Inbox") {
                    if records.isEmpty {
                        Text("Nothing bumped yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(records.prefix(8))) { record in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(record.kind.title).font(.headline)
                                Spacer()
                                if record.queuedOffline {
                                    StatusChip(text: "Queued", tint: GCTheme.grab, loud: true)
                                } else if record.applied {
                                    StatusChip(text: "In", tint: GCTheme.onSite)
                                }
                            }
                            Text("\(record.fromDevice) → \(record.toDevice)")
                                .font(.caption)
                            Text(record.summary)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Button("Deliver queued (back in range)") {
                        bump.flushQueue(context: modelContext)
                        try? modelContext.save()
                    }
                }
            }
            .navigationTitle("Bump")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Bump") { send() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Text("Both devices need GC Field Log. This is not the system AirDrop sheet. Local demo path writes the inbox on this device.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding()
            }
        }
        .presentationDetents([.large])
    }

    private func send() {
        guard let device else { return }
        let current = sheets.first { $0.isCurrentSet }
        let payload = BumpPayload(
            kind: kind,
            fromDevice: me.map { "\($0.shortName)'s phone" } ?? "This device",
            fromCrew: me?.name ?? "Crew",
            floor: "L2",
            sheetName: current?.displayName,
            grabSummary: materials.filter { $0.status == .grabIt }.map(\.itemDescription).joined(separator: ", "),
            toolNames: tools.filter { $0.holderName == me?.name }.map(\.name),
            hours: kind == .endOfDayDump ? hours : nil,
            leftoverMaterial: leftover,
            rfiTitles: rfis.filter { $0.status != .sentToForeman }.map(\.pinLabel),
            problemTitles: problems.filter { $0.status != .resolved }.map(\.title),
            notes: notes.isEmpty ? defaultNote : notes,
            includeCurrentSet: kind == .jobHandoff || kind == .morningAssignment,
            queuedBecauseOffline: bump.basementMode
        )
        if kind == .asBuiltRedlines {
            for mark in redlines where !mark.bumpedToGF {
                mark.bumpedToGF = true
            }
        }
        bump.send(payload, to: device, context: modelContext)
        try? modelContext.save()
        session.flash(bump.lastMessage ?? "Bumped.")
        dismiss()
    }

    private var defaultNote: String {
        switch kind {
        case .morningAssignment: "L2 · current set · grab list in Material."
        case .endOfDayDump: "Walking out. Time, leftovers, tools, open paper."
        case .jobHandoff: "Current prints, LP-2A schedule, material, tools out, open RFIs."
        case .inspectionReady: "Rooms ready. Bump to GF — they walk it."
        case .asBuiltRedlines: "Redlines on E-201. Demo marks only."
        }
    }
}
