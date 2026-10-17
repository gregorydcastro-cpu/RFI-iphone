import SwiftUI

struct PhoneRootView: View {
    @Environment(SessionController.self) private var session

    var body: some View {
        VStack(spacing: 0) {
            JobChromeBar()
            destinationView
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if session.isPINSession {
                PINSessionBanner()
            }
            PhoneTabBar()
        }
        .background(Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private var destinationView: some View {
        switch session.destination {
        case .rfi: RFIListView()
        case .problem: ProblemListView()
        case .material: MaterialListView()
        case .foreman: ForemanHomeView()
        case .count: CountView()
        case .tools: ToolsListView()
        case .time: TimeWeekView()
        }
    }
}

struct PhoneTabBar: View {
    @Environment(SessionController.self) private var session

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppDestination.allCases) { dest in
                let locked = session.isPINSession && !dest.allowedDuringPINSession
                Button {
                    guard !locked else { return }
                    session.destination = dest
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: dest.symbol)
                            .font(.system(size: 18, weight: .semibold))
                        Text(dest.title)
                            .font(.system(size: 10, weight: .semibold))
                            .minimumScaleFactor(0.7)
                            .lineLimit(1)
                    }
                    .foregroundStyle(color(for: dest, locked: locked))
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 52)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(dest.title)
                .accessibilityAddTraits(session.destination == dest ? .isSelected : [])
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 4)
        .padding(.bottom, 2)
        .background(.bar)
        .overlay(alignment: .top) {
            Divider()
        }
    }

    private func color(for dest: AppDestination, locked: Bool) -> Color {
        if locked { return .secondary.opacity(0.35) }
        return session.destination == dest ? GCTheme.brand : .secondary
    }
}
