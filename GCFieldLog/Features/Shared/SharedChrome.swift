import SwiftData
import SwiftUI

struct JobChromeBar: View {
    @Environment(SessionController.self) private var session
    @Query(sort: \Job.name) private var jobs: [Job]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @Query(sort: \DrawingSheet.revision) private var sheets: [DrawingSheet]
    @State private var showAccounts = false
    @State private var showBump = false

    private var job: Job? { jobs.first { $0.id == session.activeJobID } ?? jobs.first }
    private var currentSheets: [DrawingSheet] {
        sheets.filter { $0.job?.id == job?.id }
    }
    private var sheet: DrawingSheet? {
        currentSheets.first { $0.id == session.activeSheetID } ?? currentSheets.first { $0.isCurrentSet }
    }
    private var me: CrewMember? { session.member(from: crew) }
    private var host: CrewMember? { session.signedIn(from: crew) }

    var body: some View {
        HStack(spacing: 10) {
            Menu {
                ForEach(jobs) { item in
                    Button(item.name) { session.activeJobID = item.id }
                }
            } label: {
                chromeLabel(title: job?.name ?? "No job", symbol: "building.2")
            }

            Menu {
                ForEach(currentSheets) { item in
                    Button {
                        session.activeSheetID = item.id
                        if !item.isCurrentSet {
                            session.flash("That sheet is not the current set. Count Rev \(currentSheets.first(where: \.isCurrentSet)?.revision ?? 1).")
                        }
                    } label: {
                        Label(item.displayName, systemImage: item.isCurrentSet ? "checkmark.circle.fill" : "clock")
                    }
                }
            } label: {
                chromeLabel(title: sheet?.displayName ?? "No sheet", symbol: "doc")
            }

            Spacer(minLength: 8)

            Button {
                showBump = true
            } label: {
                Label("Bump", systemImage: "wave.3.right")
                    .labelStyle(.iconOnly)
                    .font(.title3.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Bump nearby device")

            if host?.role == .foreman || host?.role == .generalForeman {
                Button {
                    session.showPINPad = true
                } label: {
                    Label("Crew PIN", systemImage: "key.fill")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 10)
                        .frame(minHeight: 40)
                        .background(GCTheme.brandSoft, in: Capsule())
                }
                .accessibilityHint("Let a crew member punch or check out a tool without the foreman password")
            }

            Button {
                showAccounts = true
            } label: {
                Label(me?.shortName ?? "Account", systemImage: "person.crop.circle")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 10)
                    .frame(minHeight: 40)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.bar)
        .sheet(isPresented: $showAccounts) {
            AccountSwitchView(crew: crew)
        }
        .sheet(isPresented: $showBump) {
            BumpComposerView()
        }
    }

    private func chromeLabel(title: String, symbol: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: symbol)
            Text(title)
                .lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.caption2.weight(.bold))
        }
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 10)
        .frame(minHeight: 40)
        .background(Color.secondary.opacity(0.10), in: Capsule())
        .foregroundStyle(.primary)
    }
}

struct PINSessionBanner: View {
    @Environment(SessionController.self) private var session
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    var body: some View {
        let guest = session.member(from: crew)
        let host = session.signedIn(from: crew)
        HStack {
            Image(systemName: "key.fill")
            Text("\(guest?.name ?? "Crew") on this iPad")
                .font(.subheadline.weight(.semibold))
            Spacer()
            Button("Return to \(host?.shortName ?? "foreman")") {
                session.endPINSession(returningTo: host?.name ?? "foreman")
            }
            .font(.subheadline.weight(.bold))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(GCTheme.grab.opacity(0.18))
    }
}

struct AccountSwitchView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.dismiss) private var dismiss
    let crew: [CrewMember]

    var body: some View {
        NavigationStack {
            List(crew) { member in
                Button {
                    session.switchAccount(to: member)
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: member.role.symbol)
                            .font(.title2)
                            .foregroundStyle(GCTheme.brand)
                            .frame(width: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(member.name)
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text("\(member.role.title) · PIN \(member.pin)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if member.id == session.signedInID {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(GCTheme.brand)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
            .navigationTitle("Demo accounts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Text("v1 is on-device only. Real crew names come later via accounts. Nobody shares the foreman password — crew PIN-switches on the job iPad.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding()
            }
        }
        .presentationDetents([.medium, .large])
    }
}
