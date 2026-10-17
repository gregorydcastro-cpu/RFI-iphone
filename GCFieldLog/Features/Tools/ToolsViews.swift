import SwiftData
import SwiftUI

struct ToolsListView: View {
    @Environment(SessionController.self) private var session
    @Query(sort: \JobTool.name) private var tools: [JobTool]

    private var items: [JobTool] {
        tools.filter { $0.job?.id == session.activeJobID }
    }

    var body: some View {
        NavigationStack {
            List(items) { tool in
                NavigationLink(value: tool.id) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(tool.name).font(.headline)
                            Text("\(tool.kindLabel) · \(tool.floor)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        toolBadge(tool)
                    }
                    .padding(.vertical, 6)
                }
            }
            .navigationTitle("Tools")
            .navigationDestination(for: UUID.self) { id in
                if let tool = items.first(where: { $0.id == id }) {
                    ToolDetailView(tool: tool)
                }
            }
            .overlay {
                if items.isEmpty {
                    EmptyJobsiteState(
                        symbol: "wrench.and.screwdriver",
                        title: "No tools on this job",
                        message: "If it is not listed, you will hunt the floor for it."
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func toolBadge(_ tool: JobTool) -> some View {
        switch tool.availability {
        case .available:
            StatusChip(text: "Free", tint: GCTheme.onSite)
        case .checkedOut:
            StatusChip(text: tool.holderName ?? "Out", tint: GCTheme.grab)
        case .reserved:
            StatusChip(text: "Reserved", tint: GCTheme.ordered)
        }
    }
}

struct ToolsSplitView: View {
    var body: some View {
        ToolsListView()
    }
}

struct ToolDetailView: View {
    @Bindable var tool: JobTool
    @Environment(SessionController.self) private var session
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]
    @State private var reserveDays = 1

    private var me: CrewMember? { session.member(from: crew) }

    var body: some View {
        Form {
            Section("Where") {
                LabeledContent("Kind", value: tool.kindLabel)
                LabeledContent("Floor", value: tool.floor)
                if let holder = tool.holderName {
                    LabeledContent("Who has it", value: holder)
                }
                if let reserved = tool.reservedForName {
                    LabeledContent("Reserved for", value: reserved)
                    if let date = tool.reservedDate {
                        LabeledContent("When", value: date.formatted(date: .abbreviated, time: .omitted))
                    }
                }
            }
            Section("Check out") {
                Button("Check out to me") {
                    tool.holderName = me?.name
                    tool.reservedForName = nil
                    tool.reservedDate = nil
                    session.flash("\(tool.name) is with \(me?.name ?? "you").")
                    if session.isPINSession {
                        flipBack()
                    }
                }
                .buttonStyle(JobsiteButtonStyle())
                .disabled(tool.holderName != nil)

                Button("Check in") {
                    tool.holderName = nil
                    session.flash("\(tool.name) back on \(tool.floor).")
                    if session.isPINSession {
                        flipBack()
                    }
                }
                .buttonStyle(JobsiteButtonStyle(kind: .secondary))
                .disabled(tool.holderName == nil)
            }
            Section("Can I use it later?") {
                Stepper(reserveDays == 1 ? "Tomorrow" : "In \(reserveDays) days", value: $reserveDays, in: 1...14)
                Button("Reserve") {
                    tool.reservedForName = me?.name
                    tool.reservedDate = Calendar.current.date(byAdding: .day, value: reserveDays, to: .now)
                    session.flash("Reserved. Still check it out the morning you need it.")
                }
                .buttonStyle(JobsiteButtonStyle(kind: .quiet))
            }
        }
        .navigationTitle(tool.name)
    }

    private func flipBack() {
        if let host = session.signedIn(from: crew) {
            session.endPINSession(returningTo: host.name)
        }
    }
}
