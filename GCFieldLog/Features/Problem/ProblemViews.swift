import SwiftData
import SwiftUI

struct ProblemListView: View {
    @Environment(SessionController.self) private var session
    @Query(sort: \FieldProblem.createdAt, order: .reverse) private var problems: [FieldProblem]

    private var items: [FieldProblem] {
        problems.filter { $0.job?.id == session.activeJobID }
    }

    var body: some View {
        NavigationStack {
            List(items) { problem in
                NavigationLink(value: problem.id) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(problem.title).font(.headline)
                            Spacer()
                            StatusChip(text: problem.status.title, tint: problem.status.tint)
                        }
                        Text(problem.location)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Problem")
            .navigationDestination(for: UUID.self) { id in
                if let problem = items.first(where: { $0.id == id }) {
                    ProblemDetailView(problem: problem)
                }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        ProblemComposerView()
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("New field problem")
                }
            }
            .overlay {
                if items.isEmpty {
                    EmptyJobsiteState(
                        symbol: "exclamationmark.triangle",
                        title: "No field problems",
                        message: "A problem is not an RFI and not a Procore ticket. Log it so the next person does not rediscover it."
                    )
                }
            }
        }
    }
}

struct ProblemSplitView: View {
    var body: some View {
        ProblemListView()
    }
}

struct ProblemDetailView: View {
    @Bindable var problem: FieldProblem

    var body: some View {
        Form {
            Section("Problem") {
                Text(problem.title).font(.headline)
                Text(problem.notes)
                LabeledContent("Where", value: problem.location)
                LabeledContent("Who logged it", value: problem.reporterName)
            }
            Section("Status") {
                Picker("Status", selection: $problem.statusRaw) {
                    ForEach(ProblemStatus.allCases) { status in
                        Text(status.title).tag(status.rawValue)
                    }
                }
                Text("Keep this off the RFI list unless it truly needs design. Field problems die on the floor, not in Procore.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Field problem")
    }
}

struct ProblemComposerView: View {
    @Environment(SessionController.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var jobs: [Job]
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    @State private var title = ""
    @State private var notes = ""
    @State private var location = "L2"

    var body: some View {
        Form {
            TextField("What is in the way?", text: $title)
            TextField("Notes", text: $notes, axis: .vertical)
            TextField("Location", text: $location)
        }
        .navigationTitle("New problem")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    guard let job = jobs.first(where: { $0.id == session.activeJobID }) else { return }
                    let problem = FieldProblem(
                        title: title,
                        notes: notes,
                        location: location,
                        status: .open,
                        reporterName: session.member(from: crew)?.name ?? "Crew"
                    )
                    problem.job = job
                    modelContext.insert(problem)
                    try? modelContext.save()
                    session.flash("Logged. Not an RFI.")
                    dismiss()
                }
                .disabled(title.isEmpty)
            }
        }
    }
}
