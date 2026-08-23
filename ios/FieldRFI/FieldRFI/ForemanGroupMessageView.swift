import SwiftUI

/// Optional all-hands to every Foreman inbox on this phone.
/// Separate from tool find. Apprentice needs a GF-granted direct line.
struct ForemanGroupMessageComposer: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var features = FeatureSettings.shared
    @ObservedObject private var outbox = FieldOutbox.shared
    @State private var note = ""
    @State private var message: String?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ALL FOREMEN")
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(FieldTheme.muted)
            Text("Optional group text to every Foreman on \(ShopCrew.jobName). Lands in the on-device inbox. Not tool find — find still opens the one holder only. No Procore.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            if features.mayGroupMessageForemen(from: session.userID) {
                TextField("All-hands note", text: $note)
                    .textFieldStyle(.roundedBorder)
                Button {
                    send()
                } label: {
                    Text("Send to all Foremen")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(canSend ? FieldTheme.orange : FieldTheme.muted)
                }
                .disabled(!canSend)
                Text("Goes to \(ShopCrew.foremen.map(\.name).joined(separator: ", ")).")
                    .font(.caption2)
                    .foregroundStyle(FieldTheme.muted)
            } else if session.isApprentice, !features.hasDirectLine(session.userID) {
                Text("Apprentices cannot skip to all Foremen unless the GF granted a direct line.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            } else {
                Text("The person above blocked send for this seat.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
            if let message {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
            }
        }
    }

    private var canSend: Bool {
        features.mayGroupMessageForemen(from: session.userID)
            && !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func send() {
        guard let me = ShopCrew.member(byID: session.userID) else {
            error = "Pick who you are on \(ShopCrew.jobName)."
            return
        }
        let rows = outbox.sendGroupToForemen(note: note, from: me)
        if rows.isEmpty {
            error = "Could not send the group text."
            message = nil
        } else {
            error = nil
            message = "Sent to \(rows.map(\.sentToName).joined(separator: ", ")). On this phone."
            note = ""
        }
    }
}
