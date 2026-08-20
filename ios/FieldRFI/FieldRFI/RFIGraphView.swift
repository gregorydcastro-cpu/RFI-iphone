import SwiftUI

struct RFIGraphView: View {
    @StateObject private var model = RFIGraphViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                sampleBanner
                if let graph = model.graph {
                    bucketBars(graph)
                    machineDiagram(graph.status_machine)
                    Text("Open RFIs")
                        .font(.headline)
                    Text("Weekly log. Drafts, closed, and void are off this list.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                    ForEach(graph.open) { row in
                        actorLink(row)
                    }
                    if graph.open.isEmpty {
                        Text("No open RFIs.")
                            .foregroundStyle(FieldTheme.muted)
                    }

                    Text("Drafts (no number)")
                        .font(.headline)
                        .padding(.top, 8)
                    Text("Drafts stay off the meeting graph until a PE submits. Tap a draft to open the PE Submit screen.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                    ForEach(graph.drafts) { row in
                        actorLink(row, draft: true)
                    }
                    Text("Closed / void excluded from the open list: \(graph.closed_or_void_count)")
                        .font(.caption)
                        .foregroundStyle(FieldTheme.muted)
                    Text(graph.days_open_rule)
                        .font(.caption2)
                        .foregroundStyle(FieldTheme.muted)
                } else if model.isLoading {
                    ProgressView("Loading weekly log…")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                }
                if let error = model.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("RFI Graph")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Reload") { Task { await model.load() } }
            }
        }
        .onAppear { Task { await model.load() } }
    }

    private var sampleBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SAMPLE meeting log")
                .font(.caption.weight(.bold))
                .foregroundStyle(FieldTheme.orange)
            Text("PE-seeded examples so the weekly graph is not empty. Not live ILSB field RFIs. The E-803 vivarium draft is real and stays unnumbered.")
                .font(.footnote)
                .foregroundStyle(FieldTheme.ink)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(FieldTheme.orange.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func bucketBars(_ graph: GraphResponseDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Age buckets")
                .font(.headline)
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(graph.bucket_order, id: \.self) { bucket in
                    let count = graph.bucket_counts[bucket] ?? 0
                    VStack(spacing: 4) {
                        Text("\(count)")
                            .font(.caption2.monospacedDigit())
                        RoundedRectangle(cornerRadius: 3)
                            .fill(bucketColor(bucket))
                            .frame(height: CGFloat(8 + count * 14))
                        Text(bucket.replacingOccurrences(of: "_", with: "\n"))
                            .font(.system(size: 8, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(10)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private func machineDiagram(_ machine: StatusMachineDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Status machine (sample)")
                .font(.headline)
            Text(machine.note)
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            FlowWrap(items: machine.main)
            Text("Branches: \(machine.branches.joined(separator: "  ·  "))")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private func actorLink(_ row: GraphRowDTO, draft: Bool = false) -> some View {
        Group {
            if ["draft", "internal_review", "needs_clarification"].contains(row.status) {
                NavigationLink {
                    PESubmitView(rfiID: row.id)
                } label: {
                    graphRow(row, draft: draft)
                }
                .buttonStyle(.plain)
            } else if ["submitted", "ball_in_court"].contains(row.status) {
                NavigationLink {
                    AnswerRFIView(rfiID: row.id)
                } label: {
                    graphRow(row, draft: draft)
                }
                .buttonStyle(.plain)
            } else if ["answered", "impact_review"].contains(row.status) {
                NavigationLink {
                    GCImpactView(rfiID: row.id)
                } label: {
                    graphRow(row, draft: draft)
                }
                .buttonStyle(.plain)
            } else {
                graphRow(row, draft: draft)
            }
        }
    }

    private func graphRow(_ row: GraphRowDTO, draft: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(row.rfi_display ?? "no number")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(draft ? FieldTheme.muted : FieldTheme.ink)
                if draft || ["draft", "internal_review", "needs_clarification"].contains(row.status) {
                    Text("PE Submit")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(FieldTheme.steel.opacity(0.12))
                        .foregroundStyle(FieldTheme.steel)
                        .clipShape(Capsule())
                }
                if ["submitted", "ball_in_court"].contains(row.status) {
                    Text("Answer")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(FieldTheme.orange.opacity(0.14))
                        .foregroundStyle(FieldTheme.orange)
                        .clipShape(Capsule())
                }
                if ["answered", "impact_review"].contains(row.status) {
                    Text("Impact")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(red: 0.25, green: 0.40, blue: 0.70).opacity(0.14))
                        .foregroundStyle(Color(red: 0.25, green: 0.40, blue: 0.70))
                        .clipShape(Capsule())
                }
                if row.is_sample {
                    Text("SAMPLE")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(FieldTheme.orange.opacity(0.18))
                        .foregroundStyle(FieldTheme.orange)
                        .clipShape(Capsule())
                }
                Spacer()
                if let bucket = row.age_bucket {
                    Text(bucket.replacingOccurrences(of: "_", with: " "))
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(bucketColor(bucket).opacity(0.18))
                        .foregroundStyle(bucketColor(bucket))
                        .clipShape(Capsule())
                }
            }
            Text(row.subject)
                .font(.subheadline)
            HStack {
                Text(row.sheet_number ?? "—")
                Text("·")
                Text(row.status)
                Text("·")
                Text(row.priority)
                if row.work_stopped {
                    Text("· work stopped")
                        .foregroundStyle(FieldTheme.orange)
                }
            }
            .font(.caption)
            .foregroundStyle(FieldTheme.muted)
            HStack {
                Text(row.assigned ?? "unassigned")
                Spacer()
                Text("due \(row.due_at ?? "none")")
                Text("· \(row.days_open)d open")
            }
            .font(.caption2)
            .foregroundStyle(FieldTheme.muted)
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(FieldTheme.rule, lineWidth: 1)
        )
    }

    private func bucketColor(_ bucket: String) -> Color {
        switch bucket {
        case "work_stopped": return Color.red
        case "escalated": return FieldTheme.orange
        case "overdue": return Color(red: 0.75, green: 0.28, blue: 0.18)
        case "due_soon": return Color(red: 0.80, green: 0.55, blue: 0.10)
        case "gc_holding": return Color(red: 0.25, green: 0.40, blue: 0.70)
        case "missing_due": return Color(red: 0.45, green: 0.45, blue: 0.50)
        default: return Color(red: 0.16, green: 0.45, blue: 0.28)
        }
    }
}

struct FlowWrap: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(items.joined(separator: "  →  "))
                .font(.caption.monospaced())
                .foregroundStyle(FieldTheme.ink)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

#Preview {
    NavigationStack {
        RFIGraphView()
    }
}
