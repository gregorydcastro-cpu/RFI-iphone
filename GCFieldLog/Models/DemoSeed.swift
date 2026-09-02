import Foundation
import SwiftData

enum DemoSeed {
    static let jobName = "Maple Point Demo Job"
    static let sheetTitle = "Lighting L2"
    static let sheetNumber = "E-201"
    static let disclaimer = "Demo job, invented drawing. Not a real project."

    /// Safe from `App.init`. Do not use `container.mainContext` here — that property is MainActor-isolated.
    nonisolated static func ensure(in container: ModelContainer) {
        let context = ModelContext(container)
        ensure(in: context)
    }

    nonisolated static func ensure(in context: ModelContext) {
        let existing = try? context.fetch(FetchDescriptor<Job>())
        if let existing, !existing.isEmpty { return }
        seed(in: context)
    }

    nonisolated static func previewContainer() -> ModelContainer {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let schema = SchemaModels.schema
        let container = try! ModelContainer(for: schema, configurations: config)
        ensure(in: container)
        return container
    }

    nonisolated static func seed(in context: ModelContext) {
        let pat = CrewMember(id: DemoIDs.pat, name: "Pat Nguyen", role: .foreman, pin: "1001", shortName: "Pat")
        let alex = CrewMember(id: DemoIDs.alex, name: "Alex Rivera", role: .journeyman, pin: "2002", shortName: "Alex")
        let sam = CrewMember(id: DemoIDs.sam, name: "Sam Ortiz", role: .apprentice, pin: "3003", shortName: "Sam")
        let jordan = CrewMember(id: DemoIDs.jordan, name: "Jordan Lee", role: .apprentice, pin: "4004", shortName: "Jordan")
        [pat, alex, sam, jordan].forEach { context.insert($0) }

        let job = Job(
            id: DemoIDs.job,
            name: jobName,
            jobNumber: "MP-DEMO-01",
            siteLabel: "410 Maple Point Drive — fictional campus annex",
            currentFloor: "L2"
        )
        context.insert(job)

        let current = DrawingSheet(
            id: DemoIDs.sheetCurrent,
            number: sheetNumber,
            title: sheetTitle,
            revision: 1,
            scaleText: "1/8 in = 1 ft",
            pageWidthInches: 36,
            pageHeightInches: 24,
            isCurrentSet: true,
            receivedFromProcoreAt: Date().addingTimeInterval(-3600 * 6)
        )
        let old = DrawingSheet(
            id: DemoIDs.sheetOld,
            number: sheetNumber,
            title: sheetTitle,
            revision: 0,
            scaleText: "1/8 in = 1 ft",
            pageWidthInches: 36,
            pageHeightInches: 24,
            isCurrentSet: false,
            receivedFromProcoreAt: Date().addingTimeInterval(-3600 * 80)
        )
        current.job = job
        old.job = job
        job.sheets = [current, old]

        let materials: [MaterialLine] = [
            MaterialLine(itemDescription: "2x4 troffers", quantity: 12, status: .grabIt, sourceLabel: "Grok count · Office zone"),
            MaterialLine(itemDescription: "Downlights", quantity: 8, status: .grabIt, sourceLabel: "Grok count · Office zone"),
            MaterialLine(itemDescription: "Duplex receptacles", quantity: 18, status: .grabIt, sourceLabel: "Grok count · Office zone"),
            MaterialLine(itemDescription: "3/4\" EMT connectors", quantity: 25, status: .grabIt, sourceLabel: "Manual"),
            MaterialLine(
                itemDescription: "20A 1-pole breakers",
                quantity: 4,
                status: .backordered,
                sourceLabel: "Order draft",
                packingSlipNote: "Vendor: 10-day slip. Do not install around missing breakers."
            ),
            MaterialLine(itemDescription: "12/2 MC", quantity: 200, unit: "ft", status: .ordered, sourceLabel: "Order draft"),
            MaterialLine(itemDescription: "Occupancy sensors", quantity: 2, status: .needed, sourceLabel: "Foreman list"),
            MaterialLine(
                itemDescription: "LP-2A interior kit",
                quantity: 1,
                status: .onSite,
                sourceLabel: "Packing slip",
                receivedQuantity: 1
            )
        ]
        for line in materials {
            line.job = job
        }
        job.materials = materials

        let rfiReady = RFIPacket(
            question: "Office at grid C-5 shows Type A 2x4 troffers. Spec section 26 51 00 on this demo set calls Type A2 (0-10V). Which fixture do we hang?",
            suggestedSpecRef: "26 51 00 Lighting — Maple Point demo spec (invented)",
            pinLabel: "Office · grid C-5",
            sheetDisplayName: current.displayName,
            sheetRevision: 1,
            status: .readyForForeman,
            authorName: alex.name,
            photoCount: 2
        )
        let rfiDraft = RFIPacket(
            question: "Panel LP-2A schedule lists 6 spares. Door card on the invented shop set shows 4. Confirm spare count before we land homeruns.",
            suggestedSpecRef: "Panel schedule LP-2A — pulled set, not filed",
            pinLabel: "Corridor closet · LP-2A",
            sheetDisplayName: current.displayName,
            sheetRevision: 1,
            status: .draft,
            authorName: alex.name
        )
        rfiReady.job = job
        rfiDraft.job = job
        job.rfis = [rfiReady, rfiDraft]

        let p1 = FieldProblem(
            title: "Shop ceiling grid fights 2x4 frame",
            notes: "Grid tee lands on the fixture centerline. Not an RFI — shop local. Need a 6\" shift or a different tee.",
            location: "Shop · L2",
            status: .open,
            reporterName: alex.name
        )
        let p2 = FieldProblem(
            title: "Corridor west wet from pipe test",
            notes: "Standing water near receptacles. Tape off until dry. Field problem, not a Procore ticket.",
            location: "Corridor west · L2",
            status: .inProgress,
            reporterName: sam.name
        )
        p1.job = job
        p2.job = job
        job.problems = [p1, p2]

        let tools: [JobTool] = [
            JobTool(name: "Rotary laser", kindLabel: "Laser", floor: "L2", holderName: alex.name),
            JobTool(name: "Greenlee 3/4 bender", kindLabel: "Pipe bender", floor: "L2 gang box"),
            JobTool(
                name: "Wire puller",
                kindLabel: "Wire puller",
                floor: "L2 closet",
                reservedForName: pat.name,
                reservedDate: Calendar.current.date(byAdding: .day, value: 1, to: .now)
            ),
            JobTool(name: "100' fish tape", kindLabel: "Fish tape", floor: "L2", holderName: sam.name)
        ]
        for tool in tools {
            tool.job = job
        }
        job.tools = tools

        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        func day(_ offset: Int) -> Date {
            cal.date(byAdding: .day, value: offset, to: today) ?? today
        }
        // Build a Mon–near-today week of hours. Sunday-based offset so OT shows in red.
        var time: [TimeEntry] = []
        let crew: [(CrewMember, [Double])] = [
            (pat, [8, 8, 9, 8, 8]),
            (alex, [8, 10, 8, 8, 8]),
            (sam, [8, 8, 8, 8, 4]),
            (jordan, [8, 8, 8, 8, 8])
        ]
        for (member, hours) in crew {
            for (index, value) in hours.enumerated() {
                let entry = TimeEntry(
                    workerName: member.name,
                    workerID: member.id,
                    day: day(index - 4),
                    hours: value,
                    source: index == 4 && member.id == DemoIDs.sam ? .punch : .foremanEdit
                )
                entry.job = job
                time.append(entry)
            }
        }
        job.timeEntries = time

        let panel = Panel(name: "LP-2A", location: "Corridor electrical closet · L2", voltage: "208Y/120V")
        panel.job = job
        let circuits: [PanelCircuit] = [
            PanelCircuit(number: 1, loadName: "Office lighting — Type A 2x4", breakerAmps: 20, poles: 1, roomName: "Office"),
            PanelCircuit(number: 3, loadName: "Office lighting — Type A 2x4", breakerAmps: 20, poles: 1, roomName: "Office"),
            PanelCircuit(number: 5, loadName: "Shop lighting — downlights", breakerAmps: 20, poles: 1, roomName: "Shop"),
            PanelCircuit(number: 7, loadName: "Corridor lighting", breakerAmps: 20, poles: 1, roomName: "Corridor"),
            PanelCircuit(number: 9, loadName: "Office receptacles west", breakerAmps: 20, poles: 1, roomName: "Office"),
            PanelCircuit(number: 11, loadName: "Office receptacles east", breakerAmps: 20, poles: 1, roomName: "Office"),
            PanelCircuit(number: 13, loadName: "Shop receptacles", breakerAmps: 20, poles: 1, roomName: "Shop"),
            PanelCircuit(number: 15, loadName: "Spare", breakerAmps: 20, poles: 1, roomName: "—"),
            PanelCircuit(number: 17, loadName: "Spare", breakerAmps: 20, poles: 1, roomName: "—")
        ]
        for circuit in circuits {
            circuit.panel = panel
        }
        panel.circuits = circuits
        job.panels = [panel]

        let redline = AsBuiltMark(
            note: "As-built: last downlight in shop shifted 4' west to miss duct. Demo mark only.",
            authorName: alex.name,
            normalizedX: 0.78,
            normalizedY: 0.28
        )
        redline.job = job
        job.redlines = [redline]

        let rooms: [RoomProgress] = [
            RoomProgress(name: "Office", fixtureKind: "2x4 troffer", counted: 12, installed: 4),
            RoomProgress(name: "Shop", fixtureKind: "Downlight", counted: 6, installed: 2),
            RoomProgress(name: "Corridor", fixtureKind: "Downlight", counted: 2, installed: 2)
        ]
        for room in rooms {
            room.job = job
        }
        job.rooms = rooms

        let queued = BumpRecord(
            kind: .endOfDayDump,
            fromDevice: "Alex's iPhone",
            toDevice: "Job iPad",
            summary: "Queued in the basement (no signal): 8.0 hrs, fish tape still out, 1 open problem.",
            applied: false,
            queuedOffline: true
        )
        context.insert(queued)

        try? context.save()
    }
}
