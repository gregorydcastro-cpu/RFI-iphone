import SwiftUI

/// Invented lighting plan: Office / Shop / Corridor, grid C-5. Not a real drawing.
struct InteractiveLightingPlan: View {
    var selectedZone: String
    var showZoneBox: Bool
    var redlines: [AsBuiltMark]
    var onSelectZone: (String) -> Void
    var onTapDevice: (PlanDevice) -> Void
    var onLongPress: ((CGPoint) -> Void)? = nil

    var body: some View {
        GeometryReader { geo in
            LightingPlanCanvas(
                selectedZone: selectedZone,
                showZoneBox: showZoneBox,
                redlines: redlines
            )
            .contentShape(Rectangle())
            .gesture(
                SpatialTapGesture().onEnded { event in
                    let n = CGPoint(x: event.location.x / geo.size.width, y: event.location.y / geo.size.height)
                    if let device = PlanGeometry.device(near: n) {
                        onTapDevice(device)
                    } else if let zone = PlanGeometry.zone(at: n) {
                        onSelectZone(zone.name)
                    }
                }
            )
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.6).sequenced(before: DragGesture(minimumDistance: 0))
                    .onEnded { value in
                        if case .second(true, let drag) = value, let loc = drag?.location {
                            let n = CGPoint(x: loc.x / geo.size.width, y: loc.y / geo.size.height)
                            onLongPress?(n)
                        }
                    }
            )
        }
        .aspectRatio(36.0 / 24.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.secondary.opacity(0.25))
        )
        .accessibilityLabel("Invented lighting plan for Maple Point Demo Job, E-201 Lighting L2 Rev 1")
    }
}

struct LightingPlanCanvas: View {
    var selectedZone: String
    var showZoneBox: Bool
    var redlines: [AsBuiltMark]

    var body: some View {
        Canvas { context, canvasSize in
            context.fill(Path(CGRect(origin: .zero, size: canvasSize)), with: .color(GCTheme.drawingPaper))
            PlanGeometry.draw(in: &context, size: canvasSize, selectedZone: selectedZone, showZoneBox: showZoneBox, redlines: redlines)
        }
    }
}

struct PlanDevice: Identifiable, Hashable {
    var id: String
    var kind: SymbolKind
    var normalized: CGPoint
    var circuit: Int
    var panel: String
    var room: String
}

enum PlanGeometry {
    static let office = CGRect(x: 0.06, y: 0.10, width: 0.46, height: 0.46)
    static let shop = CGRect(x: 0.52, y: 0.10, width: 0.42, height: 0.46)
    static let corridor = CGRect(x: 0.06, y: 0.56, width: 0.88, height: 0.22)

    static func zone(named name: String) -> PlanZone? {
        switch name {
        case "Office": return PlanZone(name: "Office", rect: office)
        case "Shop": return PlanZone(name: "Shop", rect: shop)
        case "Corridor": return PlanZone(name: "Corridor", rect: corridor)
        default: return nil
        }
    }

    static func zone(at point: CGPoint) -> PlanZone? {
        if office.contains(point) { return zone(named: "Office") }
        if shop.contains(point) { return zone(named: "Shop") }
        if corridor.contains(point) { return zone(named: "Corridor") }
        return nil
    }

    static let devices: [PlanDevice] = {
        var items: [PlanDevice] = []
        // 12 troffers in Office — 3 rows × 4
        for row in 0..<3 {
            for col in 0..<4 {
                let x = 0.12 + Double(col) * 0.10
                let y = 0.18 + Double(row) * 0.12
                items.append(PlanDevice(
                    id: "T-\(row)-\(col)",
                    kind: .troffer2x4,
                    normalized: CGPoint(x: x, y: y),
                    circuit: col < 2 ? 1 : 3,
                    panel: "LP-2A",
                    room: "Office"
                ))
            }
        }
        // 8 downlights: 6 shop + 2 corridor
        let downs: [(CGFloat, CGFloat, String, Int)] = [
            (0.60, 0.20, "Shop", 5), (0.70, 0.20, "Shop", 5), (0.80, 0.20, "Shop", 5),
            (0.60, 0.36, "Shop", 5), (0.70, 0.36, "Shop", 5), (0.80, 0.36, "Shop", 5),
            (0.22, 0.66, "Corridor", 7), (0.72, 0.66, "Corridor", 7)
        ]
        for (i, d) in downs.enumerated() {
            items.append(PlanDevice(id: "D-\(i)", kind: .downlight, normalized: CGPoint(x: d.0, y: d.1), circuit: d.3, panel: "LP-2A", room: d.2))
        }
        // 18 duplex around office + extras
        var duplexPoints: [(CGFloat, CGFloat, String, Int)] = []
        for i in 0..<8 {
            duplexPoints.append((0.08, 0.16 + CGFloat(i) * 0.05, "Office", 9))
        }
        for i in 0..<6 {
            duplexPoints.append((0.48, 0.16 + CGFloat(i) * 0.06, "Office", 11))
        }
        for i in 0..<4 {
            duplexPoints.append((0.16 + CGFloat(i) * 0.08, 0.52, "Office", 9))
        }
        for (i, d) in duplexPoints.enumerated() {
            items.append(PlanDevice(id: "R-\(i)", kind: .duplex, normalized: CGPoint(x: d.0, y: d.1), circuit: d.3, panel: "LP-2A", room: d.2))
        }
        return items
    }()

    static func device(near point: CGPoint, threshold: CGFloat = 0.035) -> PlanDevice? {
        devices.min(by: {
            hypot($0.normalized.x - point.x, $0.normalized.y - point.y)
                < hypot($1.normalized.x - point.x, $1.normalized.y - point.y)
        }).flatMap {
            hypot($0.normalized.x - point.x, $0.normalized.y - point.y) < threshold ? $0 : nil
        }
    }

    static func draw(in context: inout GraphicsContext, size: CGSize, selectedZone: String, showZoneBox: Bool, redlines: [AsBuiltMark]) {
        func rect(_ n: CGRect) -> CGRect {
            CGRect(x: n.minX * size.width, y: n.minY * size.height, width: n.width * size.width, height: n.height * size.height)
        }

        let wall = Color.primary.opacity(0.85)
        for room in [office, shop, corridor] {
            context.stroke(Path(rect(room)), with: .color(wall), lineWidth: 2)
        }

        // Room names
        context.draw(Text("OFFICE").font(.system(size: 13, weight: .bold)).foregroundColor(.secondary), at: CGPoint(x: rect(office).midX, y: rect(office).minY + 14))
        context.draw(Text("SHOP").font(.system(size: 13, weight: .bold)).foregroundColor(.secondary), at: CGPoint(x: rect(shop).midX, y: rect(shop).minY + 14))
        context.draw(Text("CORRIDOR").font(.system(size: 13, weight: .bold)).foregroundColor(.secondary), at: CGPoint(x: rect(corridor).midX, y: rect(corridor).minY + 14))

        // Grid C-5 bubble
        let bubble = CGPoint(x: office.maxX * size.width, y: office.minY * size.height)
        let bubbleRect = CGRect(x: bubble.x - 14, y: bubble.y - 14, width: 28, height: 28)
        context.stroke(Path(ellipseIn: bubbleRect), with: .color(wall), lineWidth: 1.5)
        context.draw(Text("C").font(.system(size: 9, weight: .bold)), at: CGPoint(x: bubble.x, y: bubble.y - 22))
        context.draw(Text("5").font(.system(size: 9, weight: .bold)), at: CGPoint(x: bubble.x + 22, y: bubble.y))

        // Panel
        let panel = CGRect(x: 0.45 * size.width, y: 0.70 * size.height, width: 0.08 * size.width, height: 0.05 * size.height)
        context.stroke(Path(panel), with: .color(wall), lineWidth: 1.5)
        context.draw(Text("LP-2A").font(.system(size: 8, weight: .bold)), at: CGPoint(x: panel.midX, y: panel.midY))

        for device in devices {
            let p = CGPoint(x: device.normalized.x * size.width, y: device.normalized.y * size.height)
            switch device.kind {
            case .troffer2x4:
                let r = CGRect(x: p.x - 14, y: p.y - 7, width: 28, height: 14)
                context.stroke(Path(r), with: .color(wall), lineWidth: 1)
                var line = Path()
                line.move(to: CGPoint(x: r.minX, y: r.midY))
                line.addLine(to: CGPoint(x: r.maxX, y: r.midY))
                context.stroke(line, with: .color(wall), lineWidth: 1)
            case .downlight:
                let r = CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)
                context.stroke(Path(ellipseIn: r), with: .color(wall), lineWidth: 1)
            case .duplex:
                let r = CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)
                context.stroke(Path(ellipseIn: r), with: .color(wall), lineWidth: 1)
                var ticks = Path()
                ticks.move(to: CGPoint(x: p.x - 2, y: p.y - 3))
                ticks.addLine(to: CGPoint(x: p.x - 2, y: p.y + 3))
                ticks.move(to: CGPoint(x: p.x + 2, y: p.y - 3))
                ticks.addLine(to: CGPoint(x: p.x + 2, y: p.y + 3))
                context.stroke(ticks, with: .color(wall), lineWidth: 1)
            default:
                break
            }
        }

        if showZoneBox, let z = zone(named: selectedZone) {
            let r = rect(z).insetBy(dx: -6, dy: -6)
            context.stroke(Path(r), with: .color(GCTheme.zone), style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
        }

        for mark in redlines {
            let p = CGPoint(x: mark.normalizedX * size.width, y: mark.normalizedY * size.height)
            context.stroke(Path(ellipseIn: CGRect(x: p.x - 11, y: p.y - 11, width: 22, height: 22)), with: .color(.red), lineWidth: 2)
            context.draw(Text("ASB").font(.system(size: 8, weight: .heavy)).foregroundColor(.red), at: CGPoint(x: p.x, y: p.y - 18))
        }

        // North + scale
        var north = Path()
        let n = CGPoint(x: 0.10 * size.width, y: 0.90 * size.height)
        north.move(to: CGPoint(x: n.x, y: n.y + 14))
        north.addLine(to: CGPoint(x: n.x, y: n.y - 14))
        context.stroke(north, with: .color(wall), lineWidth: 1.5)
        context.draw(Text("N").font(.system(size: 10, weight: .bold)), at: CGPoint(x: n.x, y: n.y - 22))

        let scaleOrigin = CGPoint(x: 0.22 * size.width, y: 0.90 * size.height)
        var scale = Path()
        scale.move(to: scaleOrigin)
        scale.addLine(to: CGPoint(x: scaleOrigin.x + 80, y: scaleOrigin.y))
        context.stroke(scale, with: .color(wall), lineWidth: 2)
        context.draw(Text("0    4    8    12 ft").font(.system(size: 8)), at: CGPoint(x: scaleOrigin.x + 40, y: scaleOrigin.y + 10))

        context.draw(
            Text("E-201 Lighting L2 Rev 1  ·  Maple Point Demo Job  ·  invented drawing").font(.system(size: 8)).foregroundColor(.secondary),
            at: CGPoint(x: size.width * 0.62, y: size.height * 0.94)
        )
    }
}
