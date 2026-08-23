import SwiftUI

struct ToolCheckoutView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var board = ToolBoard.shared
    @State private var query = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Shop tools on \(ShopCrew.jobName). Check out to a crew name already in the app. Search by name or vendor. On this phone. No barcode. No Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                ShopSeatPicker()

                TextField("Search name or vendor", text: $query)
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
            if let holder = tool.holderName {
                Text("Out with \(holder)")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FieldTheme.orange)
            } else {
                Text("In the shop")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
            }
            if tool.isOut {
                Button("Check in") {
                    board.checkIn(id: tool.id)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.steel)
            } else {
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
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }
}
