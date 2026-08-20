import SwiftUI

struct PESubmitView: View {
    @StateObject private var model: PESubmitViewModel

    init(rfiID: String) {
        _model = StateObject(wrappedValue: PESubmitViewModel(rfiID: rfiID))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if model.isLoading {
                    ProgressView("Loading draft…")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                }
                if let rfi = model.rfi {
                    draftSummary(rfi)
                    priorityBlock
                    reviewBlock
                    assigneeBlock
                    commentBlock
                    if model.submitResult == nil {
                        submitButton
                    }
                    if let result = model.submitResult {
                        resultBanner(result)
                    }
                }
                if let error = model.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                Text("This screen is PE-only. Grok still cannot submit, number, or set work_stopped.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Submit RFI")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await model.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("PE Submit")
                .font(.caption.weight(.bold))
                .foregroundStyle(FieldTheme.orange)
            Text("Approve internal review, assign ball-in-court, then submit. First submit mints the number. An answer is not a CO and does not authorize work.")
                .font(.subheadline)
                .foregroundStyle(FieldTheme.ink)
        }
    }

    private func draftSummary(_ rfi: RFIDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(rfi.rfi_display ?? "no number")
                .font(.headline)
            Text(rfi.subject)
                .font(.subheadline)
            Text(rfi.question)
                .font(.footnote)
                .foregroundStyle(FieldTheme.ink)
            HStack {
                Text(rfi.status)
                Text("·")
                Text(rfi.priority)
                if rfi.work_stopped == true {
                    Text("· work stopped")
                        .foregroundStyle(FieldTheme.orange)
                }
            }
            .font(.caption)
            .foregroundStyle(FieldTheme.muted)
            if let refs = rfi.refs, !refs.isEmpty {
                Text("Refs: " + refs.compactMap(\.sheet_number).joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            if let pins = rfi.pins, !pins.isEmpty {
                Text("Pins: \(pins.count)")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private var priorityBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Priority")
            Picker("Priority", selection: Binding(
                get: { model.priority },
                set: { model.syncPriority(fromPriority: $0) }
            )) {
                Text("Standard").tag("standard")
                Text("Urgent").tag("urgent")
                Text("Work stopped").tag("work_stopped")
            }
            .pickerStyle(.segmented)
            Toggle(
                "Work stopped",
                isOn: Binding(
                    get: { model.workStopped },
                    set: { model.syncWorkStopped($0) }
                )
            )
            Text("Synced: work_stopped is true only when priority is work_stopped. Grok cannot set this; PE may.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private var reviewBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Internal review")
            Toggle("Require internal review", isOn: $model.requireInternalReview)
            Button {
                Task { await model.approveReview() }
            } label: {
                HStack {
                    if model.isWorking && model.rfi?.status == "draft" {
                        ProgressView().tint(.white)
                    }
                    Text(model.rfi?.status == "internal_review" ? "Internal review approved" : "Approve internal review")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(model.canApprove ? FieldTheme.steel : FieldTheme.steel.opacity(0.35))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(!model.canApprove)
            if model.requireInternalReview && model.rfi?.status == "draft" {
                Text("Submit stays disabled until internal review is approved.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
        }
    }

    private var assigneeBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Ball in court")
            Menu {
                ForEach(model.roster?.users ?? []) { user in
                    Button {
                        model.selectedUserID = user.id
                        model.selectedCompanyID = user.company_id ?? model.selectedCompanyID
                    } label: {
                        Label(
                            user.company_name.map { "\(user.name)  ·  \($0)" } ?? user.name,
                            systemImage: user.id == model.selectedUserID ? "checkmark" : ""
                        )
                    }
                }
            } label: {
                rowLabel(model.selectedUser.map { "\($0.name)  ·  \($0.role)" } ?? "Select assignee")
            }
            Menu {
                ForEach(model.roster?.companies ?? []) { company in
                    Button {
                        model.selectedCompanyID = company.id
                    } label: {
                        Label(company.name, systemImage: company.id == model.selectedCompanyID ? "checkmark" : "")
                    }
                }
            } label: {
                rowLabel(model.selectedCompany.map { "\($0.name)  ·  \($0.kind)" } ?? "Select company")
            }
        }
    }

    private var commentBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Comment (optional)")
            TextEditor(text: $model.comment)
                .frame(minHeight: 80)
                .padding(8)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
        }
    }

    private var submitButton: some View {
        Button {
            Task { await model.submit() }
        } label: {
            HStack {
                if model.isWorking && model.rfi?.status != "draft" {
                    ProgressView().tint(.white)
                }
                Text(model.isWorking ? "Submitting…" : "Submit")
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(model.canSubmit ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(!model.canSubmit)
    }

    private func resultBanner(_ result: PESubmitResultDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Submitted")
                .font(.subheadline.weight(.semibold))
            Text("Number: \(result.rfi_display ?? "none")")
            Text("Status: \(result.status)")
            Text("Due: \(result.due_at ?? "none")")
            Text("First submit: \(result.first_submit ? "yes" : "no")")
            Text(result.message)
                .font(.footnote)
        }
        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.16, green: 0.45, blue: 0.28).opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }

    private func rowLabel(_ text: String) -> some View {
        HStack {
            Text(text)
                .foregroundStyle(FieldTheme.ink)
            Spacer()
            Image(systemName: "chevron.up.chevron.down")
                .font(.caption.weight(.semibold))
                .foregroundStyle(FieldTheme.muted)
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }
}
