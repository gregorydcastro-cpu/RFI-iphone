import SwiftUI

/// One person on the selected sample job. Harbor* are people names only. One-step-up contact only.
/// Tool find opens this card. It does not message every Foreman.
struct CrewCardView: View {
    let member: CrewMemberDTO
    var highlightToolName: String? = nil

    @ObservedObject private var tools = ToolBoard.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(member.name)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(FieldTheme.ink)
                Text(member.role.replacingOccurrences(of: "_", with: " "))
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.muted)
                Text(ShopCrew.jobName)
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)

                if let highlightToolName, !highlightToolName.isEmpty {
                    Text("Has \(highlightToolName)")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FieldTheme.orange)
                }

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("One step up")
                    if let boss = ShopCrew.oneStepUp(from: member) {
                        NavigationLink {
                            CrewCardView(member: boss)
                        } label: {
                            contactRow(boss, subtitle: "Talk to this person. Not every Foreman.")
                        }
                    } else {
                        Text("Top of the chain on \(ShopCrew.jobName). No one-step-up above this seat.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                }

                let held = tools.heldBy(member.user_id)
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Tools on this phone")
                    if held.isEmpty {
                        Text("No shop tool checked out to \(member.name).")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    ForEach(held) { tool in
                        Text(tool.vendor.isEmpty ? tool.name : "\(tool.name)  ·  \(tool.vendor)")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.ink)
                    }
                }

                Text("This card is the one holder. It does not blast a message to every Foreman. On this phone. No Procore.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Crew")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    private func contactRow(_ person: CrewMemberDTO, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(person.name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.ink)
            Text(person.role.replacingOccurrences(of: "_", with: " "))
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(FieldTheme.orange)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
