import SwiftUI
import UIKit

/// Jobsite-first visual system. Large tap targets, high contrast, Dynamic Type.
enum GCTheme {
    static let brand = Color(red: 0.40, green: 0.25, blue: 0.86)
    static let brandInk = Color(red: 0.27, green: 0.14, blue: 0.62)
    static let brandSoft = Color(red: 0.40, green: 0.25, blue: 0.86).opacity(0.14)

    static let backorder = Color(red: 0.86, green: 0.15, blue: 0.15)
    static let backorderSoft = Color(red: 0.86, green: 0.15, blue: 0.15).opacity(0.16)
    static let onSite = Color(red: 0.05, green: 0.55, blue: 0.38)
    static let ordered = Color(red: 0.15, green: 0.39, blue: 0.72)
    static let grab = Color(red: 0.75, green: 0.42, blue: 0.04)
    static let needed = Color(red: 0.35, green: 0.36, blue: 0.40)
    static let overtime = Color(red: 0.86, green: 0.15, blue: 0.15)

    static let drawingInk = Color.primary
    static let drawingPaper = Color(light: Color(red: 0.99, green: 0.99, blue: 0.97), dark: Color(red: 0.10, green: 0.10, blue: 0.11))
    static let zone = brand
    static let minTap: CGFloat = 48
    static let cardRadius: CGFloat = 16
}

extension Color {
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(dark)
                : UIColor(light)
        })
    }
}

struct JobsiteButtonStyle: ButtonStyle {
    var kind: Kind = .primary
    enum Kind { case primary, secondary, destructive, quiet }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .multilineTextAlignment(.center)
            .frame(minHeight: GCTheme.minTap)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .background(background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .foregroundStyle(foreground)
            .opacity(configuration.isPressed ? 0.82 : 1)
    }

    private var background: Color {
        switch kind {
        case .primary: GCTheme.brand
        case .secondary: GCTheme.brandSoft
        case .destructive: GCTheme.backorder
        case .quiet: Color.secondary.opacity(0.12)
        }
    }

    private var foreground: Color {
        switch kind {
        case .primary, .destructive: .white
        case .secondary: GCTheme.brandInk
        case .quiet: .primary
        }
    }
}

struct StatusChip: View {
    let text: String
    var tint: Color
    var loud: Bool = false

    var body: some View {
        Text(text)
            .font(loud ? .headline : .subheadline.weight(.semibold))
            .padding(.horizontal, loud ? 12 : 8)
            .padding(.vertical, loud ? 8 : 4)
            .foregroundStyle(loud ? Color.white : tint)
            .background(loud ? tint : tint.opacity(0.16), in: Capsule())
            .accessibilityAddTraits(loud ? .isHeader : [])
    }
}

struct EmptyJobsiteState: View {
    let symbol: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(message)
        } actions: {
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(JobsiteButtonStyle())
                    .frame(maxWidth: 280)
            }
        }
        .padding()
    }
}

struct QuantityMark: View {
    let value: String
    var tint: Color = GCTheme.brand

    var body: some View {
        Text(value)
            .font(.system(.title, design: .rounded).weight(.bold))
            .foregroundStyle(tint)
            .monospacedDigit()
            .frame(minWidth: 44, alignment: .trailing)
            .accessibilityLabel("\(value)")
    }
}
