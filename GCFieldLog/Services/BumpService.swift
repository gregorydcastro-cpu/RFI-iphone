import Foundation
import Observation
import SwiftData

struct NearbyDevice: Identifiable, Hashable {
    var id: String
    var name: String
    var kind: String
}

struct BumpPayload: Codable, Hashable {
    var kind: BumpKind
    var fromDevice: String
    var fromCrew: String
    var floor: String?
    var sheetName: String?
    var grabSummary: String?
    var toolNames: [String]
    var hours: Double?
    var leftoverMaterial: String?
    var rfiTitles: [String]
    var problemTitles: [String]
    var notes: String
    var includeCurrentSet: Bool
    var queuedBecauseOffline: Bool
}

/// In-app peer bump — not the system AirDrop sheet.
/// Demo transport stays on-device so a single simulator can exercise the path.
@Observable
final class BumpService {
    var nearby: [NearbyDevice] = [
        .init(id: "ipad-job", name: "Job iPad", kind: "Shared iPad"),
        .init(id: "iphone-alex", name: "Alex's iPhone", kind: "iPhone"),
        .init(id: "iphone-sam", name: "Sam's iPhone", kind: "iPhone"),
        .init(id: "iphone-jordan", name: "Jordan's iPhone", kind: "iPhone"),
        .init(id: "iphone-pat", name: "Pat's iPhone", kind: "iPhone")
    ]

    var lastMessage: String?
    var basementMode: Bool = false

    func send(_ payload: BumpPayload, to device: NearbyDevice, context: ModelContext) {
        let encoded = (try? JSONEncoder().encode(payload)) ?? Data()
        _ = encoded

        if basementMode || payload.queuedBecauseOffline {
            let record = BumpRecord(
                kind: payload.kind,
                fromDevice: payload.fromDevice,
                toDevice: device.name,
                summary: "Queued — no signal. Will bump when back in range. \(payload.notes)",
                applied: false,
                queuedOffline: true
            )
            context.insert(record)
            lastMessage = "Queued on \(device.name). Walk into range and bump again."
            return
        }

        apply(payload, context: context)
        let record = BumpRecord(
            kind: payload.kind,
            fromDevice: payload.fromDevice,
            toDevice: device.name,
            summary: summary(for: payload),
            applied: true,
            queuedOffline: false
        )
        context.insert(record)
        lastMessage = "Bumped to \(device.name)."
    }

    func flushQueue(context: ModelContext) {
        let queued = (try? context.fetch(FetchDescriptor<BumpRecord>()))?.filter { $0.queuedOffline && !$0.applied } ?? []
        for record in queued {
            record.queuedOffline = false
            record.applied = true
            record.summary = "Delivered after range restored. " + record.summary
        }
        lastMessage = queued.isEmpty ? "Nothing waiting." : "Delivered \(queued.count) queued bump(s)."
    }

    func apply(_ payload: BumpPayload, context: ModelContext) {
        // Local-demo apply: a received handoff / dump is recorded; material leftovers
        // stay visible via the bump inbox. Real Multipeer would decode on the peer.
        _ = context
        _ = payload
    }

    func summary(for payload: BumpPayload) -> String {
        switch payload.kind {
        case .morningAssignment:
            return "Assignment: \(payload.floor ?? "floor") · \(payload.sheetName ?? "sheet") · \(payload.grabSummary ?? "no grab")"
        case .endOfDayDump:
            let hrs = payload.hours.map { String(format: "%.1f hrs", $0) } ?? "no punch"
            return "Dump: \(hrs). \(payload.notes)"
        case .jobHandoff:
            return "Handoff packet: prints, panels, material, tools, open RFIs."
        case .inspectionReady:
            return "Inspection-ready package for GF."
        case .asBuiltRedlines:
            return "As-built redlines bumped to GF."
        }
    }
}
