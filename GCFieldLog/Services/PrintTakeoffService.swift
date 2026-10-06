import Foundation
import CoreGraphics

struct SymbolLegendEntry: Identifiable, Hashable, Codable {
    var id: SymbolKind
    var mark: String
    var specName: String
}

struct TakeoffCount: Identifiable, Hashable, Codable {
    var id: SymbolKind { kind }
    var kind: SymbolKind
    var quantity: Int
}

struct TakeoffResult: Hashable, Codable {
    var sheetDisplayName: String
    var zoneName: String
    var counts: [TakeoffCount]
    var scaleText: String
    var pageLabel: String
    var homerunFeet: Double
    var slackNote: String
    var usedVisionAPI: Bool
}

/// Ingests a spec PDF + symbol legend, then counts a sheet or boxed zone.
/// Demo path is fully stubbed — no API keys, no network.
protocol PrintTakeoffServicing: Sendable {
    func ingest(specPDF: Data, legend: [SymbolLegendEntry]) async
    func count(sheet: SheetTakeoffInput, zone: PlanZone?) async -> TakeoffResult
}

struct SheetTakeoffInput: Hashable, Sendable {
    var displayName: String
    var scaleText: String
    var pageWidthInches: Double
    var pageHeightInches: Double
}

struct PlanZone: Hashable, Sendable {
    var name: String
    /// Normalized sheet coordinates, origin top-left.
    var rect: CGRect
}

struct StubPrintTakeoffService: PrintTakeoffServicing {
    /// Structured so a later `GrokVisionTakeoffService` can replace this type.
    static let demoLegend: [SymbolLegendEntry] = [
        .init(id: .troffer2x4, mark: "rectangle + center line", specName: "Type A 2x4 troffer"),
        .init(id: .downlight, mark: "circle", specName: "Type C downlight"),
        .init(id: .duplex, mark: "circle + two ticks", specName: "Duplex receptacle"),
        .init(id: .switchToggle, mark: "S", specName: "Single-pole switch"),
        .init(id: .gfci, mark: "circle + GFCI", specName: "GFCI receptacle")
    ]

    func ingest(specPDF: Data, legend: [SymbolLegendEntry]) async {
        _ = specPDF
        _ = legend
    }

    func count(sheet: SheetTakeoffInput, zone: PlanZone?) async -> TakeoffResult {
        // Deterministic invented counts for Maple Point demo. No vision call.
        let zoneName = zone?.name ?? "Full sheet"
        let counts: [TakeoffCount]
        switch zone?.name {
        case "Office":
            counts = [
                .init(kind: .troffer2x4, quantity: 12),
                .init(kind: .downlight, quantity: 8),
                .init(kind: .duplex, quantity: 18)
            ]
        case "Shop":
            counts = [
                .init(kind: .troffer2x4, quantity: 0),
                .init(kind: .downlight, quantity: 6),
                .init(kind: .duplex, quantity: 10)
            ]
        case "Corridor":
            counts = [
                .init(kind: .troffer2x4, quantity: 0),
                .init(kind: .downlight, quantity: 2),
                .init(kind: .duplex, quantity: 6)
            ]
        default:
            counts = [
                .init(kind: .troffer2x4, quantity: 12),
                .init(kind: .downlight, quantity: 16),
                .init(kind: .duplex, quantity: 34)
            ]
        }

        let panel = CGPoint(x: 0.48, y: 0.72)
        let zoneCenter = zone.map {
            CGPoint(x: $0.rect.midX, y: $0.rect.midY)
        } ?? CGPoint(x: 0.30, y: 0.32)
        let feet = ScaleService.scaledFeet(
            from: zoneCenter,
            to: panel,
            pageWidthInches: sheet.pageWidthInches,
            pageHeightInches: sheet.pageHeightInches,
            scaleText: sheet.scaleText
        )
        // Demo Office → LP-2A lands near the mockup's ~186 ft.
        let homerun = zone?.name == "Office" ? 186.0 : (feet * 10).rounded() / 10

        return TakeoffResult(
            sheetDisplayName: sheet.displayName,
            zoneName: zoneName,
            counts: counts.filter { $0.quantity > 0 },
            scaleText: sheet.scaleText,
            pageLabel: "PDF: \(Int(sheet.pageHeightInches))x\(Int(sheet.pageWidthInches)) full size",
            homerunFeet: homerun,
            slackNote: "Slack is a separate add. Not included in the scaled run.",
            usedVisionAPI: false
        )
    }
}

/// Placeholder for a future xAI / Grok vision implementation. Not wired. No keys.
struct GrokVisionTakeoffService: PrintTakeoffServicing {
    var endpoint: URL?
    var apiKey: String?

    func ingest(specPDF: Data, legend: [SymbolLegendEntry]) async {
        _ = specPDF
        _ = legend
    }

    func count(sheet: SheetTakeoffInput, zone: PlanZone?) async -> TakeoffResult {
        await StubPrintTakeoffService().count(sheet: sheet, zone: zone)
    }
}
