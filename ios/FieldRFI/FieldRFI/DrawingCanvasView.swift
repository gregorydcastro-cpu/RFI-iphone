import SwiftUI
import UIKit

struct DrawingCanvasView: View {
    let imageData: Data?
    let pin: PinDTO?
    let onDrop: (Double, Double) -> Void

    var body: some View {
        GeometryReader { geo in
            ZStack {
                FieldTheme.paper
                if let imageData, let uiImage = UIImage(data: imageData) {
                    let fit = Self.aspectFit(imageSize: uiImage.size, in: geo.size)
                    Image(uiImage: uiImage)
                        .resizable()
                        .frame(width: fit.width, height: fit.height)
                        .position(x: fit.midX, y: fit.midY)
                    Color.clear
                        .frame(width: fit.width, height: fit.height)
                        .position(x: fit.midX, y: fit.midY)
                        .contentShape(Rectangle())
                        .onTapGesture { location in
                            guard fit.width > 0, fit.height > 0 else { return }
                            let x = min(max(location.x / fit.width, 0), 1)
                            let y = min(max(location.y / fit.height, 0), 1)
                            onDrop(x, y)
                        }
                    if let pin {
                        let point = CGPoint(
                            x: fit.minX + fit.width * pin.x_norm,
                            y: fit.minY + fit.height * pin.y_norm
                        )
                        PinMarker(label: pin.label)
                            .position(point)
                    }
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "doc.richtext")
                            .font(.system(size: 28))
                        Text("Select a sheet revision to load the drawing.")
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    .padding()
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(FieldTheme.rule, lineWidth: 1)
        )
    }

    static func aspectFit(imageSize: CGSize, in bounds: CGSize) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0, bounds.width > 0, bounds.height > 0 else {
            return .zero
        }
        let scale = min(bounds.width / imageSize.width, bounds.height / imageSize.height)
        let width = imageSize.width * scale
        let height = imageSize.height * scale
        return CGRect(
            x: (bounds.width - width) / 2,
            y: (bounds.height - height) / 2,
            width: width,
            height: height
        )
    }
}

struct PinMarker: View {
    let label: String?

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 28))
                .foregroundStyle(FieldTheme.orange)
                .shadow(radius: 2, y: 1)
            if let label, !label.isEmpty {
                Text(label)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.white.opacity(0.92))
                    .clipShape(Capsule())
            }
        }
        .offset(y: -14)
    }
}
