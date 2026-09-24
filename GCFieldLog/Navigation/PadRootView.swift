import SwiftData
import SwiftUI

struct PadRootView: View {
    @Environment(SessionController.self) private var session

    var body: some View {
        NavigationSplitView {
            SidebarColumn()
                .navigationSplitViewColumnWidth(min: 220, ideal: 250, max: 300)
        } detail: {
            VStack(spacing: 0) {
                JobChromeBar()
                if session.isPINSession {
                    PINSessionBanner()
                }
                Group {
                    switch session.destination {
                    case .rfi: RFISplitView()
                    case .problem: ProblemSplitView()
                    case .material: MaterialSplitView()
                    case .foreman: ForemanHomeView()
                    case .count: CountView()
                    case .tools: ToolsSplitView()
                    case .time: TimeWeekView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

struct SidebarColumn: View {
    @Environment(SessionController.self) private var session
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    var body: some View {
        List(selection: destBinding) {
            Section {
                ForEach(AppDestination.allCases) { dest in
                    let locked = session.isPINSession && !dest.allowedDuringPINSession
                    Label(dest.title, systemImage: dest.symbol)
                        .tag(dest)
                        .foregroundStyle(locked ? Color.secondary.opacity(0.4) : Color.primary)
                        .disabled(locked)
                }
            } header: {
                Text("Field")
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("GC Field Log")
        .safeAreaInset(edge: .bottom) {
            if let me = session.member(from: crew) {
                VStack(alignment: .leading, spacing: 6) {
                    Label(me.name, systemImage: me.role.symbol)
                        .font(.headline)
                    Text(me.role.title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
            }
        }
    }

    private var destBinding: Binding<AppDestination?> {
        Binding(
            get: { session.destination },
            set: { value in
                guard let value else { return }
                if session.isPINSession && !value.allowedDuringPINSession { return }
                session.destination = value
            }
        )
    }
}
