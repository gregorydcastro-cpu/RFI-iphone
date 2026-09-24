import SwiftData
import SwiftUI

struct CountView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query private var jobs: [Job]
    @Query private var sheets: [DrawingSheet]
    @Query private var rooms: [RoomProgress]
    @Query private var redlines: [AsBuiltMark]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    @State private var selectedDevice: PlanDevice?
    @State private var counting = false
    @State private var showLegend = false
    @State private var newRedlineText = ""
    @State private var pendingRedline: CGPoint?

    private var job: Job? { jobs.first { $0.id == session.activeJobID } }
    private var sheet: DrawingSheet? {
        sheets.first { $0.id == session.activeSheetID && $0.job?.id == job?.id }
            ?? sheets.first { $0.isCurrentSet && $0.job?.id == job?.id }
    }
    private var me: CrewMember? { session.member(from: crew) }

    var body: some View {
        GeometryReader { geo in
            let stacked = geo.size.width < 720
            let plan = planPane
            let panel = resultPane
            if stacked {
                ScrollView {
                    VStack(spacing: 12) {
                        plan.frame(minHeight: 260)
                        panel
                    }
                    .padding()
                }
            } else {
                HStack(alignment: .top, spacing: 0) {
                    plan
                        .padding()
                    Divider()
                    panel
                        .frame(width: min(380, geo.size.width * 0.38))
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .sheet(item: $selectedDevice) { device in
            DeviceCircuitSheet(device: device)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showLegend) {
            LegendIngestSheet()
        }
        .alert("As-built redline", isPresented: Binding(
            get: { pendingRedline != nil },
            set: { if !$0 { pendingRedline = nil } }
        )) {
            TextField("What changed?", text: $newRedlineText)
            Button("Save") { saveRedline() }
            Button("Cancel", role: .cancel) { pendingRedline = nil }
        } message: {
            Text("Invented demo mark on E-201. Long-press the sheet to drop another.")
        }
    }

    private var planPane: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Current set")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let sheet, !sheet.isCurrentSet {
                    StatusChip(text: "OLD REV", tint: GCTheme.backorder, loud: true)
                }
            }
            InteractiveLightingPlan(
                selectedZone: session.selectedZoneName,
                showZoneBox: true,
                redlines: redlines.filter { $0.job?.id == job?.id },
                onSelectZone: { session.selectedZoneName = $0 },
                onTapDevice: { selectedDevice = $0 },
                onLongPress: { pendingRedline = $0 }
            )
            HStack {
                ForEach(["Office", "Shop", "Corridor", "Full sheet"], id: \.self) { name in
                    Button(name) {
                        session.selectedZoneName = name
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 10)
                    .frame(minHeight: 40)
                    .background(
                        session.selectedZoneName == name ? GCTheme.brandSoft : Color.secondary.opacity(0.10),
                        in: Capsule()
                    )
                    .foregroundStyle(session.selectedZoneName == name ? GCTheme.brandInk : .primary)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            Text("Tap a fixture for panel and circuit. Long-press to drop an as-built. \(DemoSeed.disclaimer)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var resultPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label("Grok count", systemImage: "sparkle.magnifyingglass")
                        .font(.title3.weight(.bold))
                    Spacer()
                    Button {
                        showLegend = true
                    } label: {
                        Image(systemName: "list.bullet.rectangle")
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .accessibilityLabel("Symbol legend")
                }

                if let result = session.lastTakeoff {
                    ForEach(result.counts) { row in
                        HStack {
                            SymbolGlyph(kind: row.kind)
                            Text(row.kind.title)
                            Spacer()
                            Text("\(row.quantity)")
                                .font(.title2.weight(.bold))
                                .monospacedDigit()
                        }
                        .padding(.vertical, 4)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Scale: \(result.scaleText)")
                        Text(result.pageLabel)
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Wire estimate")
                            .font(.headline)
                        Text("Homerun ~\(Int(result.homerunFeet)) ft scaled, plus slack later.")
                        Text(result.slackNote)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    if !result.usedVisionAPI {
                        Text("Stub PrintTakeoffService — no API key, invented counts.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    EmptyJobsiteState(
                        symbol: "viewfinder",
                        title: "No count yet",
                        message: "Box a zone and recount. Saves a walk-back when the count is wrong."
                    )
                    .frame(minHeight: 160)
                }

                Button {
                    Task { await recount() }
                } label: {
                    Label(counting ? "Counting…" : "Recount zone", systemImage: "arrow.clockwise")
                }
                .buttonStyle(JobsiteButtonStyle(kind: .secondary))
                .disabled(counting || !(me?.role.canRunCount ?? true))

                Button {
                    addToMaterial()
                } label: {
                    Label("Add to material", systemImage: "shippingbox.fill")
                }
                .buttonStyle(JobsiteButtonStyle())
                .disabled(session.lastTakeoff == nil)

                roomProgress
            }
            .padding()
        }
        .background(Color(.systemBackground))
        .task {
            if session.lastTakeoff == nil {
                await recount()
            }
        }
    }

    private var roomProgress: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Remaining vs installed")
                .font(.headline)
            ForEach(rooms.filter { $0.job?.id == job?.id }) { room in
                HStack {
                    VStack(alignment: .leading) {
                        Text(room.name).font(.subheadline.weight(.semibold))
                        Text(room.fixtureKind).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(room.installed)/\(room.counted)")
                        .font(.headline.monospacedDigit())
                    StatusChip(text: "\(room.remaining) left", tint: room.remaining == 0 ? GCTheme.onSite : GCTheme.grab)
                }
            }
        }
    }

    private func recount() async {
        guard let sheet else { return }
        counting = true
        let input = SheetTakeoffInput(
            displayName: sheet.displayName,
            scaleText: sheet.scaleText,
            pageWidthInches: sheet.pageWidthInches,
            pageHeightInches: sheet.pageHeightInches
        )
        let zone = PlanGeometry.zone(named: session.selectedZoneName)
        let result = await StubPrintTakeoffService().count(sheet: input, zone: zone)
        session.lastTakeoff = result
        counting = false
        if !sheet.isCurrentSet {
            session.flash("You just counted an old revision. Switch to Rev 1.")
        }
    }

    private func addToMaterial() {
        guard let job, let result = session.lastTakeoff else { return }
        for row in result.counts {
            let line = MaterialLine(
                itemDescription: row.kind.plural,
                quantity: Double(row.quantity),
                status: .needed,
                sourceLabel: "Grok count · \(result.zoneName)"
            )
            line.job = job
            modelContext.insert(line)
        }
        try? modelContext.save()
        session.flash("Count is now material. Grab or order from Material.")
        session.destination = .material
    }

    private func saveRedline() {
        guard let job, let point = pendingRedline else { return }
        let mark = AsBuiltMark(
            note: newRedlineText.isEmpty ? "As-built mark" : newRedlineText,
            authorName: me?.name ?? "Crew",
            normalizedX: point.x,
            normalizedY: point.y
        )
        mark.job = job
        modelContext.insert(mark)
        try? modelContext.save()
        newRedlineText = ""
        pendingRedline = nil
        session.flash("Redline saved. Bump it to the GF when you walk by.")
    }
}

struct SymbolGlyph: View {
    let kind: SymbolKind
    var body: some View {
        Canvas { context, size in
            let wall = Color.primary
            let mid = CGPoint(x: size.width / 2, y: size.height / 2)
            switch kind {
            case .troffer2x4:
                let r = CGRect(x: 4, y: 10, width: size.width - 8, height: size.height - 20)
                context.stroke(Path(r), with: .color(wall), lineWidth: 1.5)
                var line = Path()
                line.move(to: CGPoint(x: r.minX, y: r.midY))
                line.addLine(to: CGPoint(x: r.maxX, y: r.midY))
                context.stroke(line, with: .color(wall), lineWidth: 1.5)
            case .downlight:
                context.stroke(Path(ellipseIn: CGRect(x: 8, y: 8, width: size.width - 16, height: size.height - 16)), with: .color(wall), lineWidth: 1.5)
            case .duplex:
                context.stroke(Path(ellipseIn: CGRect(x: 8, y: 8, width: size.width - 16, height: size.height - 16)), with: .color(wall), lineWidth: 1.5)
                var ticks = Path()
                ticks.move(to: CGPoint(x: mid.x - 4, y: 12))
                ticks.addLine(to: CGPoint(x: mid.x - 4, y: size.height - 12))
                ticks.move(to: CGPoint(x: mid.x + 4, y: 12))
                ticks.addLine(to: CGPoint(x: mid.x + 4, y: size.height - 12))
                context.stroke(ticks, with: .color(wall), lineWidth: 1.5)
            case .switchToggle:
                context.draw(Text("S").font(.headline), at: mid)
            case .gfci:
                context.draw(Text("G").font(.headline), at: mid)
            }
        }
        .frame(width: 36, height: 28)
        .accessibilityHidden(true)
    }
}

struct DeviceCircuitSheet: View {
    let device: PlanDevice
    @Query private var panels: [Panel]

    var body: some View {
        NavigationStack {
            List {
                LabeledContent("Device", value: device.kind.title)
                LabeledContent("Room", value: device.room)
                LabeledContent("Panel", value: device.panel)
                LabeledContent("Circuit", value: "\(device.circuit)")
                if let panel = panels.first(where: { $0.name == device.panel }),
                   let circuit = panel.circuits.first(where: { $0.number == device.circuit }) {
                    LabeledContent("Load", value: circuit.loadName)
                    LabeledContent("Breaker", value: "\(circuit.breakerAmps)A / \(circuit.poles)P")
                    LabeledContent("Panel location", value: panel.location)
                }
            }
            .navigationTitle("Panel & circuit")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct LegendIngestSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var ingested = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Drop a spec PDF and the symbol legend so Grok can tell duplex from switch from GFCI. Demo ingest is local — no key, no upload.")
                        .font(.subheadline)
                }
                Section("Legend") {
                    ForEach(StubPrintTakeoffService.demoLegend) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.specName).font(.headline)
                            Text("Mark: \(entry.mark)").font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Spec + legend")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(ingested ? "Ingested" : "Ingest demo spec") {
                        ingested = true
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
