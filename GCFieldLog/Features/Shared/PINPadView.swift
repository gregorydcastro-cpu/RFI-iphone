import SwiftUI

struct PINPadView: View {
    let crew: [CrewMember]
    var onUnlock: (CrewMember) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var digits = ""
    @State private var error: String?

    private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Crew PIN")
                    .font(.title2.weight(.bold))
                Text("Punch time or check a tool. The iPad flips back. The foreman password never leaves the signed-in account.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                HStack(spacing: 12) {
                    ForEach(0..<4, id: \.self) { index in
                        Capsule()
                            .fill(index < digits.count ? GCTheme.brand : Color.secondary.opacity(0.25))
                            .frame(width: 18, height: 18)
                    }
                }
                .padding(.vertical, 8)
                .accessibilityLabel("PIN entered \(digits.count) of 4 digits")

                if let error {
                    Text(error)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(GCTheme.backorder)
                }

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                    ForEach(keys, id: \.self) { key in
                        Button {
                            tap(key)
                        } label: {
                            Text(key)
                                .font(.title2.weight(.bold))
                                .frame(maxWidth: .infinity)
                                .frame(minHeight: 64)
                                .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)

                Text("Demo PINs: Pat 1001 · Alex 2002 · Sam 3003 · Jordan 4004")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 12)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func tap(_ key: String) {
        error = nil
        switch key {
        case "⌫":
            if !digits.isEmpty { digits.removeLast() }
        case "OK":
            submit()
        default:
            if digits.count < 4 { digits.append(key) }
            if digits.count == 4 { submit() }
        }
    }

    private func submit() {
        if let match = crew.first(where: { $0.pin == digits }) {
            onUnlock(match)
        } else if digits.count == 4 {
            error = "No match. Ask the person who owns that PIN."
            digits = ""
        }
    }
}
