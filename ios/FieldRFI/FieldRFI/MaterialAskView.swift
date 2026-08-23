import SwiftUI

struct MaterialAskView: View {
    @StateObject private var model = MaterialAskViewModel()
    @ObservedObject private var board = MaterialBoard.shared
    @EnvironmentObject private var session: FieldSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Material list. Hold it on this phone, then send it to the foreman. Not a PO. Not submitted. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                jobChrome

                if model.canOrder(session: session) {
                    composer
                    sendButton
                } else {
                    Text("Apprentice lane: pick up assigned lists. Do not order. Do not submit.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                }

                history

                if let error = model.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Material")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear { model.appear(session: session) }
    }

    private var jobChrome: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Job")
            Text(MaterialListRecord.shopTestName)
                .font(.headline)
                .foregroundStyle(FieldTheme.ink)
            Text("Sample / mock job only. Not a PO.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Held list")
            ForEach($board.held.lines) { $line in
                VStack(alignment: .leading, spacing: 8) {
                    TextField("What to buy", text: $line.description)
                        .textFieldStyle(.roundedBorder)
                    HStack {
                        TextField("Qty", value: $line.qty, format: .number)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(.roundedBorder)
                        Picker("UOM", selection: $line.uom) {
                            ForEach(model.uoms, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.menu)
                        if board.held.lines.count > 1 {
                            Button(role: .destructive) {
                                model.removeLine(id: line.id)
                            } label: {
                                Image(systemName: "minus.circle")
                            }
                        }
                    }
                }
                .padding(12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
            }
            .onChange(of: board.held.lines) { _, _ in
                model.persistHeld()
            }

            Button("Add line", action: model.addLine)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.orange)

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("Note (optional)")
                TextField("Where it goes, who needs it", text: $board.held.note)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: board.held.note) { _, _ in
                        model.persistHeld()
                    }
            }
        }
    }

    private var sendButton: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                model.sendToForeman(session: session)
            } label: {
                Text(session.sendTarget().map { "Send list to \($0.name)" } ?? "Send list to foreman")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(model.canSend(session: session) ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(!model.canSend(session: session))

            Text("The list stays on this tab. The foreman inbox gets a copy. The foreman orders later. Grokbot never submits a PO.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)

            if let sent = model.sentPacket {
                VStack(alignment: .leading, spacing: 6) {
                    Text("List sent to \(sent.sentToName)")
                        .font(.subheadline.weight(.semibold))
                    ForEach(sent.materialLines, id: \.self) { line in
                        Text("\(line.qty.formatted()) \(line.uom)  \(line.description)")
                            .font(.footnote)
                    }
                }
                .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(red: 0.16, green: 0.45, blue: 0.28).opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("On this job")
            if board.history.isEmpty {
                Text("No lists sent yet. Add lines and send, or pick up a list sent to this phone.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(board.history) { row in
                listCard(row)
            }
        }
    }

    private func listCard(_ row: MaterialListRecord) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(row.jobName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.ink)
                Spacer()
                Text(row.status.label)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(FieldTheme.orange)
            }
            ForEach(row.lines) { line in
                Text("\(line.qty.formatted()) \(line.uom)  \(line.description)")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.ink)
            }
            if !row.note.isEmpty {
                Text(row.note)
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            if let flag = row.flagNote, !flag.isEmpty {
                Text("Back-order: \(flag)")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.orange)
            }
            Text(row.sentToName.map { "\(row.createdByName) → \($0)" } ?? row.createdByName)
                .font(.caption2)
                .foregroundStyle(FieldTheme.muted)

            if row.status == .sent || row.status == .backOrdered {
                if model.canPick(session: session) && row.status != .picked {
                    Button("Mark picked") {
                        model.markPicked(id: row.id)
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.steel)
                }
                if model.canOrder(session: session) && row.status != .backOrdered {
                    TextField("Back-order note", text: flagBinding(row.id))
                        .textFieldStyle(.roundedBorder)
                    Button("Flag back-order") {
                        model.flagBackOrder(id: row.id, session: session)
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.orange)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func flagBinding(_ id: String) -> Binding<String> {
        Binding(
            get: { model.flagNotes[id] ?? "" },
            set: { model.flagNotes[id] = $0 }
        )
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
