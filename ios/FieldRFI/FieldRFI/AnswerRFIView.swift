import SwiftUI

struct AnswerRFIView: View {
    @StateObject private var model: AnswerRFIViewModel

    init(rfiID: String) {
        _model = StateObject(wrappedValue: AnswerRFIViewModel(rfiID: rfiID))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if model.isLoading {
                    ProgressView("Loading RFI…")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                }
                if let rfi = model.rfi {
                    summary(rfi)
                    disclaimer
                    if ["submitted", "ball_in_court"].contains(rfi.status) && model.actionResult == nil {
                        answerBlock
                    }
                    if let result = model.actionResult {
                        resultBanner(result)
                    }
                    if model.canStartImpact || rfi.status == "impact_review" {
                        impactBlock(rfi)
                    }
                }
                if let error = model.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                Text("Design answers only. Grok cannot answer, submit, or set work_stopped. This screen does not close the RFI or approve a CO.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Answer RFI")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await model.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Design official response")
                .font(.caption.weight(.bold))
                .foregroundStyle(FieldTheme.orange)
            Text("Answer ball-in-court, or send the RFI back to GC for clarification. Then GC starts impact review. An answer is not a change order.")
                .font(.subheadline)
                .foregroundStyle(FieldTheme.ink)
        }
    }

    private func summary(_ rfi: RFIDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(rfi.rfi_display ?? "no number")
                .font(.headline)
            Text(rfi.subject)
                .font(.subheadline)
            Text(rfi.question)
                .font(.footnote)
            HStack {
                Text(rfi.status)
                Text("·")
                Text(rfi.priority == "work_stopped" ? "urgent" : rfi.priority)
            }
            .font(.caption)
            .foregroundStyle(FieldTheme.muted)
            Text("Due \(rfi.due_at ?? "none")")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            if let refs = rfi.refs, !refs.isEmpty {
                Text("Sheets: " + refs.compactMap(\.sheet_number).joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            if let pins = rfi.pins, !pins.isEmpty {
                let first = pins[0]
                Text(String(format: "Pin  x %.2f   y %.2f   %@", first.x_norm, first.y_norm, first.label ?? ""))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(FieldTheme.muted)
            }
            if let existing = rfi.official_response, !existing.isEmpty {
                Text("Official response")
                    .font(.caption.weight(.semibold))
                    .padding(.top, 4)
                Text(existing)
                    .font(.footnote)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private var disclaimer: some View {
        Text(AnswerRFIViewModel.disclaimer)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(FieldTheme.ink)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldTheme.orange.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var answerBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OFFICIAL RESPONSE")
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(FieldTheme.muted)
            TextEditor(text: $model.responseText)
                .frame(minHeight: 140)
                .padding(8)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
            Toggle("Needs clarification instead of a full answer", isOn: $model.wantsClarification)
            Text(model.wantsClarification
                 ? "Sends the RFI back to GC. Graph age bucket becomes gc_holding. PE must re-confirm work_stopped on later resubmit."
                 : "Stores official_response, sets responded_at, and moves status to answered.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            Button {
                Task { await model.submitAnswer() }
            } label: {
                HStack {
                    if model.isWorking {
                        ProgressView().tint(.white)
                    }
                    Text(model.wantsClarification ? "Send clarification" : "Submit answer")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(model.canAnswer ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(!model.canAnswer)
        }
    }

    private func impactBlock(_ rfi: RFIDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("GC IMPACT REVIEW")
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(FieldTheme.muted)
            if rfi.status == "impact_review" {
                Text("Impact review started. Open this row from RFI Graph to draft a CO/PO or close.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            } else {
                Button {
                    Task { await model.startImpactReview() }
                } label: {
                    HStack {
                        if model.isWorking {
                            ProgressView().tint(.white)
                        }
                        Text("Start impact review")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(model.canStartImpact ? FieldTheme.steel : FieldTheme.steel.opacity(0.35))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!model.canStartImpact)
            }
        }
    }

    private func resultBanner(_ result: DesignActionResultDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(result.status == "needs_clarification" ? "Sent to GC" : "Recorded")
                .font(.subheadline.weight(.semibold))
            Text("Number: \(result.rfi_display ?? "none")")
            Text("Status: \(result.status)")
            if let responded = result.responded_at {
                Text("Responded: \(responded)")
            }
            Text(result.message)
                .font(.footnote)
        }
        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.16, green: 0.45, blue: 0.28).opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
