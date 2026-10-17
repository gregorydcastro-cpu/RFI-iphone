import SwiftData
import SwiftUI

struct MaterialListView: View {
    @Environment(SessionController.self) private var session
    @Query private var jobs: [Job]
    @Query(sort: \MaterialLine.createdAt, order: .reverse) private var lines: [MaterialLine]

    private var jobLines: [MaterialLine] {
        lines.filter { $0.job?.id == session.activeJobID }
    }

    var body: some View {
        NavigationStack {
            List {
                if jobLines.contains(where: { $0.status == .backordered }) {
                    Section {
                        let n = jobLines.filter { $0.status == .backordered }.count
                        Label("\(n) backordered — do not pretend it is on site.", systemImage: "exclamationmark.triangle.fill")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .listRowBackground(GCTheme.backorder)
                            .accessibilityAddTraits(.isHeader)
                    }
                }
                Section("Status") {
                    ForEach(MaterialStatus.allCases) { status in
                        let count = jobLines.filter { $0.status == status }.count
                        if count > 0 {
                            Label("\(status.title) · \(count)", systemImage: status.symbol)
                                .foregroundStyle(status.tint)
                        }
                    }
                }
                Section("Lines") {
                    ForEach(jobLines) { line in
                        NavigationLink(value: line.id) {
                            MaterialRow(line: line)
                        }
                    }
                }
            }
            .navigationTitle("Material")
            .navigationDestination(for: UUID.self) { id in
                if let line = jobLines.first(where: { $0.id == id }) {
                    MaterialDetailView(line: line)
                }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink("Grab list") {
                        GrabListView()
                    }
                }
            }
            .overlay {
                if jobLines.isEmpty {
                    EmptyJobsiteState(
                        symbol: "shippingbox",
                        title: "No material yet",
                        message: "Count a zone and add it here. If it is not on this list, nobody grabs it."
                    )
                }
            }
        }
    }
}

struct MaterialSplitView: View {
    var body: some View {
        HStack(spacing: 0) {
            MaterialListView()
            Divider()
            GrabListView()
                .frame(maxWidth: 420)
        }
    }
}

struct MaterialRow: View {
    let line: MaterialLine

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            QuantityMark(value: formatQty(line.quantity), tint: line.status.tint)
            VStack(alignment: .leading, spacing: 4) {
                Text(line.itemDescription)
                    .font(.headline)
                Text(line.sourceLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            StatusChip(text: line.status.title, tint: line.status.tint, loud: line.status.isLoud)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }

    private func formatQty(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }
}

struct MaterialDetailView: View {
    @Bindable var line: MaterialLine
    @Environment(SessionController.self) private var session
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @State private var slipNote = ""

    private var me: CrewMember? { session.member(from: crew) }

    var body: some View {
        Form {
            Section("Item") {
                LabeledContent("Description", value: line.itemDescription)
                LabeledContent("Quantity", value: "\(line.quantity) \(line.unit)")
                LabeledContent("Source", value: line.sourceLabel)
            }
            Section("Status") {
                Picker("Status", selection: $line.statusRaw) {
                    ForEach(MaterialStatus.allCases) { status in
                        Text(status.title).tag(status.rawValue)
                    }
                }
                .disabled(!(me?.role.canOrderMaterial ?? false) && line.status == .ordered)
            }
            Section("Packing slip") {
                Text("Snap the slip. Mark received vs still out so the next person does not hunt.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("Slip note", text: $slipNote, axis: .vertical)
                Stepper("Received \(Int(line.receivedQuantity))", value: $line.receivedQuantity, in: 0...line.quantity)
                LabeledContent("Still out", value: "\(max(0, line.quantity - line.receivedQuantity))")
                Button("Mark received from slip") {
                    line.receivedQuantity = line.quantity
                    line.stillOutQuantity = 0
                    line.status = .onSite
                    line.packingSlipNote = slipNote.isEmpty ? "Slip snapped (demo)." : slipNote
                }
                .buttonStyle(JobsiteButtonStyle())
            }
        }
        .navigationTitle(line.itemDescription)
        .onAppear { slipNote = line.packingSlipNote }
    }
}

struct GrabListView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query private var jobs: [Job]
    @Query(sort: \MaterialLine.createdAt, order: .reverse) private var lines: [MaterialLine]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @Query(sort: \GrabListSend.sentAt, order: .reverse) private var sends: [GrabListSend]

    @State private var selected: Set<UUID> = []
    @State private var note = "Grab from gang box, Level 02 west. Not a PO. Demo job only."

    private var grabLines: [MaterialLine] {
        lines.filter { $0.job?.id == session.activeJobID && ($0.status == .grabIt || $0.status == .needed) }
    }
    private var apprentices: [CrewMember] { crew.filter { $0.role == .apprentice } }
    private var me: CrewMember? { session.member(from: crew) }
    private var job: Job? { jobs.first { $0.id == session.activeJobID } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Material Grab List", systemImage: "list.clipboard")
                        .font(.headline)
                    Text("Grok Count")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Section("Grab") {
                    ForEach(grabLines) { line in
                        MaterialRow(line: line)
                    }
                }
                Section("Recipients (apprentices on this crew)") {
                    ForEach(apprentices) { person in
                        Toggle(isOn: Binding(
                            get: { selected.contains(person.id) },
                            set: { on in
                                if on { selected.insert(person.id) } else { selected.remove(person.id) }
                            }
                        )) {
                            Text(person.name)
                                .font(.headline)
                                .frame(minHeight: 36)
                        }
                    }
                }
                Section("Note") {
                    TextField("Where to grab", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }
                if !sends.filter({ $0.job?.id == session.activeJobID }).isEmpty {
                    Section("Sent") {
                        ForEach(sends.filter { $0.job?.id == session.activeJobID }) { send in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(send.recipientNames.joined(separator: ", "))
                                    .font(.headline)
                                Text(send.itemSummary)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Grab list")
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    Button {
                        sendGrab()
                    } label: {
                        Label("Send to apprentices", systemImage: "paperplane.fill")
                    }
                    .buttonStyle(JobsiteButtonStyle())
                    .disabled(selected.isEmpty || grabLines.isEmpty || !(me?.role.canSendGrabList ?? false))

                    Button {
                        session.flash("Order draft staged for Pat Nguyen. This app does not file a PO in Procore.")
                    } label: {
                        Label("Order draft to foreman", systemImage: "doc.badge.plus")
                    }
                    .buttonStyle(JobsiteButtonStyle(kind: .secondary))

                    Label("Foreman Pat Nguyen still gets the order draft.", systemImage: "info.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .background(.bar)
            }
            .onAppear {
                if selected.isEmpty {
                    selected = Set(apprentices.map(\.id))
                }
            }
        }
    }

    private func sendGrab() {
        guard let job else { return }
        let names = apprentices.filter { selected.contains($0.id) }.map(\.name)
        let summary = grabLines.map { "\(Int($0.quantity)) \($0.itemDescription)" }.joined(separator: ", ")
        let send = GrabListSend(recipientNames: names, note: note, itemSummary: summary)
        send.job = job
        modelContext.insert(send)
        for line in grabLines {
            line.status = .grabIt
        }
        try? modelContext.save()
        session.flash("Grab list to \(names.joined(separator: " + ")). Not a PO.")
    }
}
