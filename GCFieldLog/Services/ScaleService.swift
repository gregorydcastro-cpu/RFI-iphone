import Foundation
import CoreGraphics

/// Title-block scale plus full-size plot page size. Slack is never implied.
struct ScaleService {
    /// 1/8 in = 1 ft → 8 real feet per inch of paper.
    static func feetPerPaperInch(scaleText: String) -> Double {
        if scaleText.contains("1/8") { return 8 }
        if scaleText.contains("1/4") { return 4 }
        if scaleText.contains("1/16") { return 16 }
        return 8
    }

    static func realWorldSizeFeet(pageWidthInches: Double, pageHeightInches: Double, scaleText: String) -> (width: Double, height: Double) {
        let f = feetPerPaperInch(scaleText: scaleText)
        return (pageWidthInches * f, pageHeightInches * f)
    }

    /// Distance in plan feet between two normalized (0...1) points on the full sheet.
    static func scaledFeet(
        from a: CGPoint,
        to b: CGPoint,
        pageWidthInches: Double,
        pageHeightInches: Double,
        scaleText: String
    ) -> Double {
        let size = realWorldSizeFeet(pageWidthInches: pageWidthInches, pageHeightInches: pageHeightInches, scaleText: scaleText)
        let dx = (b.x - a.x) * size.width
        let dy = (b.y - a.y) * size.height
        return (dx * dx + dy * dy).squareRoot()
    }
}
