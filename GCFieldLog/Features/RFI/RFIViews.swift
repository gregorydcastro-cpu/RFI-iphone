import SwiftData
import SwiftUI

struct RFIListView: View {
    @Query(sort: \RFIPacket.createdAt, order: .reverse) private var packets: [RFIPacket]
    @Environment(SessionController.self) private var session

    private var jobPackets: [RFIPacket] {
        packets.filter { $0.job?.id == session.activeJobID }
    }

    var body: some View {
        NavigationStack {
            List(jobPackets) { packet in
                NavigationLink(value: packet.id) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(packet.question)
                            .font(.headline)
                            .lineLimit(3)
                        HStack {
                            Label(packet.pinLabel, systemImage: "mappin")
                            Text("Rev \(packet.sheetRevision)")
                            StatusChip(text: packet.status.title, tint: GCTheme.brand)
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("RFI")
            .navigationDestination(for: UUID.self) { id in
                if let packet = jobPackets.first(where: { $0.id == id }) {
                    RFIDetailView(packet: packet)
                }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        RFIComposerView()
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("New RFI packet")
                }
            }
            .overlay {
                if jobPackets.isEmpty {
                    EmptyJobsiteState(
                        symbol: "questionmark.bubble",
                        title: "No RFI packets",
                        message: "Prep a pin, revision, question, and photos. Send it to the foreman — they file it in Procore. This app never submits."
                    )
                }
            }
            .safeAreaInset(edge: .bottom) {
                Text("Read prints from Procore. Never file an RFI or PO from here.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(8)
            }
        }
    }
}

struct RFISplitView: View {
    var body: some View {
        RFIListView()
    }
}

struct RFIDetailView: View {
    @Bindable var packet: RFIPacket
    @Environment(SessionController.self) private var session
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    private var me: CrewMember? { session.member(from: crew) }

    var body: some View {
        Form {
            Section("Question") {
                Text(packet.question)
            }
            Section("Packet") {
                LabeledContent("Pin", value: packet.pinLabel)
                LabeledContent("Sheet", value: packet.sheetDisplayName)
                LabeledContent("Revision", value: "\(packet.sheetRevision)")
                LabeledContent("Spec", value: packet.suggestedSpecRef)
                LabeledContent("Photos", value: "\(packet.photoCount) attached (demo)")
                LabeledContent("Author", value: packet.authorName)
            }
            Section("Procore") {
                Text("Foreman or GF files this packet in Procore. The field app stops at send-to-foreman.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if packet.filedInProcore {
                    StatusChip(text: "Someone filed it — not from this app", tint: GCTheme.onSite)
                }
                if me?.role.canComposeRFI == true {
                    Button("Send packet to Pat Nguyen") {
                        packet.status = .sentToForeman
                        packet.sentToName = "Pat Nguyen"
                        session.flash("Packet on Pat's desk. Pat files it in Procore.")
                    }
                    .buttonStyle(JobsiteButtonStyle())
                    .disabled(packet.status == .sentToForeman)
                }
            }
        }
        .navigationTitle("RFI packet")
    }
}

struct RFIComposerView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var jobs: [Job]
    @Query private var sheets: [DrawingSheet]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    @State private var question = ""
    @State private var pin = "Office · grid C-5"
    @State private var spec = "26 51 00 Lighting — Maple Point demo spec (invented)"

    private var job: Job? { jobs.first { $0.id == session.activeJobID } }
    private var sheet: DrawingSheet? { sheets.first { $0.id == session.activeSheetID } }
    private var me: CrewMember? { session.member(from: crew) }

    var body: some View {
        Form {
            Section("Question") {
                TextField("What do you need answered to keep working?", text: $question, axis: .vertical)
                    .lineLimit(4...8)
            }
            Section("Pin + sheet") {
                TextField("Pin", text: $pin)
                LabeledContent("Sheet", value: sheet?.displayName ?? "—")
                LabeledContent("Revision", value: sheet.map { "\($0.revision)" } ?? "—")
                TextField("Spec ref", text: $spec)
            }
            Section {
                Text("Photos would attach here from the camera. Demo packet carries a photo count only.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("New packet")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private func save() {
        guard let job, let sheet, let me else { return }
        let packet = RFIPacket(
            question: question,
            suggestedSpecRef: spec,
            pinLabel: pin,
            sheetDisplayName: sheet.displayName,
            sheetRevision: sheet.revision,
            status: .readyForForeman,
            authorName: me.name,
            photoCount: 1
        )
        packet.job = job
        modelContext.insert(packet)
        try? modelContext.save()
        session.flash("Packet ready. Send it to the foreman — do not file it yourself.")
        dismiss()
    }
}
