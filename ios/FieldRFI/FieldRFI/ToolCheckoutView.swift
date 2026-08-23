import SwiftUI

struct ToolCheckoutView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var board = ToolBoard.shared
    @ObservedObject private var features = FeatureSettings.shared
    @ObservedObject private var outbox = FieldOutbox.shared
    @State private var query = ""
    @State private var blastMessage: String?
    @State private var blastError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Shop tools on \(ShopCrew.jobName). Check out to a crew name already in the app. Search by name or vendor. Find opens the one person who has it. Blast all Foremen only if the tool is lost or not checked out. On this phone. No barcode. No Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                ShopSeatPicker()

                TextField("Search name, vendor, or who has it", text: $query)
                    .textFieldStyle(.roundedBorder)

                let rows = board.matching(query)
                if rows.isEmpty {
                    Text("No tool matches that search.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                }
                ForEach(rows) { tool in
                    toolCard(tool)
                }
                if let blastError {
                    Text(blastError).font(.footnote).foregroundStyle(.red)
                }
                if let blastMessage {
                    Text(blastMessage)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Tools")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear { session.ensureShopSeat() }
    }

    private func toolCard(_ tool: ShopTool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(tool.name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.ink)
            if !tool.vendor.isEmpty {
                Text(tool.vendor)
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            if tool.hasKnownHolder, let holder = tool.holderName {
                Text("Out with \(holder)")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FieldTheme.orange)
                if let person = board.holder(of: tool) {
                    NavigationLink {
                        CrewCardView(member: person, highlightToolName: tool.name)
                    } label: {
                        Text("Find \(person.name)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(FieldTheme.orange)
                    }
                }
                Text("Holder is known. No blast to all Foremen.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
                Button("Check in") {
                    board.checkIn(id: tool.id)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.steel)
                Button("Mark lost") {
                    board.markLost(id: tool.id)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.muted)
            } else if tool.isLost {
                Text("Lost. No holder to open.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FieldTheme.orange)
                lostBlastControls(tool)
                Button("Found — back in shop") {
                    board.checkIn(id: tool.id)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.steel)
            } else {
                Text("In the shop. No holder to open.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                lostBlastControls(tool)
                Menu {
                    ForEach(ShopCrew.members) { member in
                        Button {
                            board.checkOut(id: tool.id, to: member)
                        } label: {
                            Text("\(member.name)  ·  \(member.role.replacingOccurrences(of: "_", with: " "))")
                        }
                    }
                } label: {
                    Text("Check out to crew")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FieldTheme.orange)
                }
                Button("Mark lost") {
                    board.markLost(id: tool.id)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.muted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    @ViewBuilder
    private func lostBlastControls(_ tool: ShopTool) -> some View {
        if tool.hasKnownHolder {
            EmptyView()
        } else if features.mayGroupMessageForemen(from: session.userID) {
            Button("Ask all Foremen") {
                blastLost(tool)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(FieldTheme.orange)
        } else if session.isApprentice, !features.hasDirectLine(session.userID) {
            Text("Apprentices cannot blast all Foremen unless the GF granted a direct line.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private func blastLost(_ tool: ShopTool) {
        guard !tool.hasKnownHolder else {
            blastError = "Holder is known. Open that person. Do not blast all Foremen."
            blastMessage = nil
            return
        }
        guard let me = ShopCrew.member(byID: session.userID) else {
            blastError = "Pick who you are on \(ShopCrew.jobName)."
            return
        }
        let rows = outbox.sendLostToolBlast(tool: tool, from: me)
        if rows.isEmpty {
            blastError = "Could not send the lost-tool note."
            blastMessage = nil
        } else {
            blastError = nil
            blastMessage = "Asked Foremen about \(tool.name). On this phone."
        }
    }
}
