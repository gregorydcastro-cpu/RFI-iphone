import SwiftUI

struct MaterialAskView: View {
    @StateObject private var model = MaterialAskViewModel()
    @ObservedObject private var board = MaterialBoard.shared
    @ObservedObject private var features = FeatureSettings.shared
    @EnvironmentObject private var session: FieldSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(model.canOrder(session: session)
                     ? "Order material on a held list, then send it to the foreman. Not a PO. Not submitted. Not Procore."
                     : "Assigned tickets only. Handle pickup. Do not order. Do not submit. Not a PO. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                jobChrome
                statusStrip

                if model.canOrder(session: session) {
                    composer
                    sendButton
                }

                assignedTickets
                pickedTickets

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
        .onDisappear { model.persistHeld() }
    }

    private var jobChrome: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Job")
            Text(MaterialListRecord.shopTestName)
                .font(.headline)
                .foregroundStyle(FieldTheme.ink)
            Text("Sample / mock job only.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private var statusStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Status")
            HStack(spacing: 8) {
                ForEach(board.statusCounts(), id: \.0) { item in
                    VStack(spacing: 2) {
                        Text("\(item.1)")
                            .font(.headline)
                            .foregroundStyle(FieldTheme.ink)
                        Text(item.0.label)
                            .font(.caption2)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                }
            }
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("1. Order — held list")
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
            .onChange(of: board.held) { _, _ in
                model.persistHeld()
            }

            HStack(spacing: 16) {
                Button("Add line", action: model.addLine)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.orange)
                if features.flags(for: session.userID).takeoff {
                    Button("Grok takeoff") {
                        model.runTakeoff()
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.steel)
                }
            }
            if features.flags(for: session.userID).takeoff {
                Text("Counts plate fixtures on sample sheet E-101 Rev A only. Writes the held list. Does not submit, number, or set work-stopped. Job photos are not a sheet. If the sample image is missing, it writes nothing.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
                if let takeoff = model.takeoffMessage {
                    Text(takeoff)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                }
            }

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
            SendTargetPicker()
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

            Text("Sends the list to the foreman inbox and opens an assigned pickup ticket. The foreman orders later. Grokbot never submits a PO.")
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

    private var assignedTickets: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("2. Assigned tickets — handle")
            if let pair = FeatureSettings.shared.pickupAssignee(for: session.userID) {
                Text("Pickup goes to \(pair.name) on the journeyman/apprentice pair.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            let tickets = board.assignedTickets(for: session)
            if tickets.isEmpty {
                Text(session.isApprentice
                     ? "No pickup tickets assigned yet."
                     : "Send a list to create a pickup ticket on this phone.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(tickets) { row in
                ticketCard(row, showHandle: true)
            }
        }
    }

    private var pickedTickets: some View {
        let rows = board.pickedTickets
        return Group {
            if !rows.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    sectionLabel("Picked")
                    ForEach(rows) { row in
                        ticketCard(row, showHandle: false)
                    }
                }
            }
        }
    }

    private func ticketCard(_ row: MaterialListRecord, showHandle: Bool) -> some View {
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
            Text(assignmentLine(row))
                .font(.caption2)
                .foregroundStyle(FieldTheme.muted)

            if showHandle && model.canPick(session: session) && row.status != .picked
                && (row.assignedToUserID == nil || row.assignedToUserID == session.userID) {
                Button("Handle — mark picked") {
                    model.markPicked(id: row.id)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.steel)
            }
            if showHandle && model.canFlag(session: session) && row.status != .backOrdered && row.status != .picked {
                TextField("Back-order note", text: flagBinding(row.id))
                    .textFieldStyle(.roundedBorder)
                Button("Flag back-order") {
                    model.flagBackOrder(id: row.id, session: session)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.orange)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func assignmentLine(_ row: MaterialListRecord) -> String {
        let dest = row.sentToName.map { "\(row.createdByName) → \($0)" } ?? row.createdByName
        if let name = row.assignedToName {
            return "\(dest)  ·  assigned \(name)"
        }
        return dest
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
