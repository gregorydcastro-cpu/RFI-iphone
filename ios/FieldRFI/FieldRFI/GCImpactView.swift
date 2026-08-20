import SwiftUI

struct GCImpactView: View {
    @StateObject private var model: GCImpactViewModel

    init(rfiID: String) {
        _model = StateObject(wrappedValue: GCImpactViewModel(rfiID: rfiID))
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
                    if let banner = model.banner {
                        Text(banner)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                    }
                    if rfi.status == "answered" {
                        actionButton("Start impact review", enabled: model.canStartImpact) {
                            await model.startImpact()
                        }
                    }
                    if rfi.status != "closed" {
                        changeOrderBlock
                        materialBlock
                        drafts(rfi)
                        actionButton("Close RFI", enabled: model.canClose, tone: .orange) {
                            await model.closeRFI()
                        }
                    } else {
                        Text("Closed. Draft CO and material orders stay draft — not approved, not ordered.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                }
                if let error = model.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                Text("GC only. Does not approve a CO or mark a PO ordered. Grok cannot close or draft follow-ons.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Impact review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await model.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("GC impact review")
                .font(.caption.weight(.bold))
                .foregroundStyle(FieldTheme.orange)
            Text("Start impact review, optionally draft a CO or material order, then close. An answer is not a change order and does not authorize work.")
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
            if let answer = rfi.official_response, !answer.isEmpty {
                Text("Official response")
                    .font(.caption.weight(.semibold))
                Text(answer)
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
        Text(GCImpactViewModel.disclaimer)
            .font(.footnote.weight(.semibold))
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldTheme.orange.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var changeOrderBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            section("Draft change order")
            Text("Draft only. Does not approve cost or authorize work.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            TextField("Title (required)", text: $model.coTitle)
                .textFieldStyle(.roundedBorder)
            HStack {
                TextField("Cost amount", text: $model.coCost)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                TextField("Schedule days", text: $model.coDays)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
            }
            TextField("Notes", text: $model.coNotes)
                .textFieldStyle(.roundedBorder)
            actionButton("Save draft CO", enabled: model.canDraft && !model.coTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                await model.saveChangeOrder()
            }
        }
    }

    private var materialBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            section("Draft material order")
            Text("Draft only. Not marked ordered.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            TextField("Line description", text: $model.lineDescription)
                .textFieldStyle(.roundedBorder)
            HStack {
                TextField("Qty", text: $model.lineQty)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                Picker("UOM", selection: $model.lineUom) {
                    ForEach(GCImpactViewModel.uoms, id: \.self) { Text($0).tag($0) }
                }
            }
            Button("Add line") { model.addMaterialLine() }
                .disabled(model.lineDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            ForEach(Array(model.materialLines.enumerated()), id: \.offset) { _, line in
                HStack {
                    Text("\(line.description)  ·  \(line.qty) \(line.uom)")
                        .font(.footnote)
                    Spacer()
                    Button("Remove") { model.removeMaterialLine(line) }
                        .font(.caption)
                }
            }
            actionButton("Save draft material order", enabled: model.canDraft && !model.materialLines.isEmpty) {
                await model.saveMaterialOrder()
            }
        }
    }

    private func drafts(_ rfi: RFIDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(rfi.draft_change_orders ?? []) { row in
                Text("CO draft: \(row.title ?? row.summary ?? row.id)  ·  \(row.status)")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(rfi.draft_material_orders ?? []) { row in
                Text("PO draft: \(row.line_count ?? row.lines?.count ?? 0) line(s)  ·  \(row.status)")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
        }
    }

    private func section(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }

    private enum Tone { case steel, orange }

    private func actionButton(
        _ title: String,
        enabled: Bool,
        tone: Tone = .steel,
        action: @escaping () async -> Void
    ) -> some View {
        Button {
            Task { await action() }
        } label: {
            HStack {
                if model.isWorking {
                    ProgressView().tint(.white)
                }
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(enabled ? (tone == .orange ? FieldTheme.orange : FieldTheme.steel) : FieldTheme.steel.opacity(0.35))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(!enabled)
    }
}
