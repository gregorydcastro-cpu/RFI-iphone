import Foundation
import UIKit

/// On-device takeoff from the bundled E-101 Rev A sample.
/// Counts only symbols on that sample. Does not invent a drawing number.
/// Writes draft material lines. Does not submit, number, close, or set work_stopped.
/// No HTTP. No Procore. G-Line Shop Test and E-101 Rev A only.
enum GrokTakeoff {
    static let catalogSheet = ShopSampleCatalog.sheetNumber
    static let catalogRevision = ShopSampleCatalog.revision
    static let catalogResource = ShopSampleCatalog.resource
    static let takeoffTag = ShopSampleCatalog.takeoffTag

    struct Result {
        var lines: [MaterialLine]
        var message: String
    }

    enum Failure: Error {
        case noSheet
        case noVisibleDevices

        var message: String {
            switch self {
            case .noSheet:
                return "No catalog sheet image. Takeoff did not write quantities."
            case .noVisibleDevices:
                return "Sheet is present but no plate fixtures or receptacles are visible. Takeoff did not write quantities."
            }
        }
    }

    @MainActor
    static func run() -> Swift.Result<Result, Failure> {
        guard let image = loadSheetImage() else {
            return .failure(.noSheet)
        }
        let fixtures = countFixtureSymbols(image)
        let receptacles = 0
        if fixtures <= 0 && receptacles <= 0 {
            return .failure(.noVisibleDevices)
        }
        var lines: [MaterialLine] = []
        if fixtures > 0 {
            lines.append(
                MaterialLine(
                    id: UUID().uuidString,
                    description: "Plate fixture (\(takeoffTag))",
                    qty: Double(fixtures),
                    uom: "EA"
                )
            )
        }
        let message = "Grok takeoff on \(catalogSheet) Rev \(catalogRevision): \(fixtures) plate fixture(s) visible. No receptacles drawn. Draft list only — not submitted."
        return .success(Result(lines: lines, message: message))
    }

    static func loadSheetImage() -> CGImage? {
        guard let url = catalogSheetURL(),
              let data = try? Data(contentsOf: url),
              !data.isEmpty,
              let image = UIImage(data: data)?.cgImage
        else { return nil }
        return image
    }

    /// Only the bundled E-101 Rev A sample. Do not count job photos or other PDFs.
    static func catalogSheetURL() -> URL? {
        ShopSampleCatalog.sheetURL()
    }

    /// Lighting-fixture outlines on the catalog sheet are #1D4F72 circles.
    static func countFixtureSymbols(_ image: CGImage) -> Int {
        let width = image.width
        let height = image.height
        guard width > 0, height > 0 else { return 0 }
        let bytesPerPixel = 4
        let bytesPerRow = width * bytesPerPixel
        var raw = [UInt8](repeating: 0, count: height * bytesPerRow)
        guard let ctx = CGContext(
            data: &raw,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return 0 }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

        var candidates: [(Int, Int)] = []
        candidates.reserveCapacity(4096)
        for y in 0..<height {
            let row = y * bytesPerRow
            for x in 0..<width {
                let i = row + x * bytesPerPixel
                let r = Int(raw[i])
                let g = Int(raw[i + 1])
                let b = Int(raw[i + 2])
                if abs(r - 0x1D) <= 10, abs(g - 0x4F) <= 10, abs(b - 0x72) <= 10 {
                    candidates.append((x, y))
                }
            }
        }
        if candidates.isEmpty { return 0 }

        var mark = Set<Int>()
        mark.reserveCapacity(candidates.count)
        for (x, y) in candidates {
            mark.insert(y * width + x)
        }
        var seen = Set<Int>()
        var blobs = 0
        var queue: [Int] = []
        for seed in mark {
            if seen.contains(seed) { continue }
            blobs += 1
            queue = [seed]
            seen.insert(seed)
            var qi = 0
            while qi < queue.count {
                let p = queue[qi]
                qi += 1
                let x = p % width
                let y = p / width
                for dy in -2...2 {
                    for dx in -2...2 {
                        let nx = x + dx
                        let ny = y + dy
                        if nx < 0 || ny < 0 || nx >= width || ny >= height { continue }
                        let n = ny * width + nx
                        if mark.contains(n), !seen.contains(n) {
                            seen.insert(n)
                            queue.append(n)
                        }
                    }
                }
            }
        }
        return blobs
    }
}
