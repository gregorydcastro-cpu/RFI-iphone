import SwiftUI

struct PanelScheduleView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var board = PanelBoard.shared
    @ObservedObject private var features = FeatureSettings.shared
    @State private var newPanelName = "LP-1"
    @State private var selectedID: String?
    @State private var newNumber = ""
    @State private var newDescription = ""
    @State private var editNumber: [String: String] = [:]
    @State private var editDescription: [String: String] = [:]
    @State private var noteDraft: [String: String] = [:]
    @State private var message: String?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Field tracker on \(ShopCrew.jobName). Build a panel, list circuits, check pulled so nothing is missed. A short change note stays on that circuit. Not an RFI. Not a design log. Not work-stopped. No Procore write.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                ShopSeatPicker()

                createPanel

                panelList

                if let panel {
                    panelDetail(panel)
                }

                procoreStub

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                if let message {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Panels")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            session.ensureShopSeat()
            if selectedID == nil {
                selectedID = board.panels.first?.id
            }
        }
    }

    private var me: CrewMemberDTO? {
        ShopCrew.member(byID: session.userID)
    }

    private var panel: PanelSchedule? {
        selectedID.flatMap { board.panel(id: $0) } ?? board.panels.first
    }

    private var createPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("New panel")
            TextField("Panel name", text: $newPanelName)
                .textFieldStyle(.roundedBorder)
            Button {
                if let row = board.createPanel(name: newPanelName) {
                    selectedID = row.id
                    newPanelName = ""
                    error = nil
                    message = "\(row.name) added on \(row.jobName). \(row.sheetNumber) Rev \(row.revision)."
                } else {
                    error = "Need a panel name that is not already on \(ShopCrew.jobName)."
                    message = nil
                }
            } label: {
                Text("Create panel")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(FieldTheme.orange)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            Text("Stays on \(ShopCrew.jobName) / \(ShopSampleCatalog.sheetNumber) Rev \(ShopSampleCatalog.revision). Sample job only.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private var panelList: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Panels on \(ShopCrew.jobName)")
            if board.panels.isEmpty {
                Text("No panels yet. Create one, then add circuits or fill from the sample print.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(board.panels) { row in
                Button {
                    selectedID = row.id
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(FieldTheme.ink)
                            Text("\(row.pulledCount) of \(row.circuits.count) pulled  ·  \(row.sheetNumber) Rev \(row.revision)")
                                .font(.caption)
                                .foregroundStyle(FieldTheme.muted)
                        }
                        Spacer()
                        if selectedID == row.id || (selectedID == nil && board.panels.first?.id == row.id) {
                            Image(systemName: "checkmark")
                                .foregroundStyle(FieldTheme.orange)
                        }
                    }
                    .padding(12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                }
            }
        }
    }

    private func panelDetail(_ panel: PanelSchedule) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                sectionLabel("Selected")
                Text("\(panel.name)  ·  pulled vs not pulled")
                    .font(.headline)
                    .foregroundStyle(FieldTheme.ink)
                Text("\(panel.pulledCount) pulled · \(panel.circuits.count - panel.pulledCount) still open. Tracker only.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }

            if features.flags(for: session.userID).takeoff {
                fillButton(panel)
            }

            circuitList(panel)
            addCircuit(panel)
        }
    }

    private func fillButton(_ panel: PanelSchedule) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                switch board.fillFromSample(panelID: panel.id) {
                case .wrote(let text):
                    error = nil
                    message = text
                case .failed(let text):
                    message = nil
                    error = text
                }
            } label: {
                Text("Fill from E-101 Rev A")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(FieldTheme.orange)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            Text("Counts plate fixtures on the bundled sample. Writes nothing if that sheet is missing. Does not invent circuits.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private func circuitList(_ panel: PanelSchedule) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Circuits")
            if panel.circuits.isEmpty {
                Text("No circuits yet. Add them here or fill from the sample sheet.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(panel.circuits) { circuit in
                circuitCard(panel, circuit)
            }
        }
    }

    private func circuitCard(_ panel: PanelSchedule, _ circuit: PanelCircuit) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("CKT \(circuit.number)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.ink)
                Spacer()
                Text(circuit.pulled ? "pulled" : "not pulled")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(circuit.pulled
                                     ? Color(red: 0.16, green: 0.45, blue: 0.28)
                                     : FieldTheme.orange)
            }
            TextField("Circuit number", text: Binding(
                get: { editNumber[circuit.id] ?? circuit.number },
                set: { editNumber[circuit.id] = $0 }
            ))
            .keyboardType(.numbersAndPunctuation)
            .textFieldStyle(.roundedBorder)
            TextField("Load", text: Binding(
                get: { editDescription[circuit.id] ?? circuit.description },
                set: { editDescription[circuit.id] = $0 }
            ))
            .textFieldStyle(.roundedBorder)
            Button("Save circuit") {
                let number = editNumber[circuit.id] ?? circuit.number
                let description = editDescription[circuit.id] ?? circuit.description
                if board.editCircuit(panelID: panel.id, circuitID: circuit.id, number: number, description: description) {
                    error = nil
                    message = "CKT \(number) updated."
                } else {
                    error = "Circuit number is empty or already on \(panel.name)."
                    message = nil
                }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(FieldTheme.orange)

            Toggle("Pulled", isOn: Binding(
                get: { circuit.pulled },
                set: { board.setPulled(panelID: panel.id, circuitID: circuit.id, pulled: $0, by: me) }
            ))
            .tint(FieldTheme.orange)
            if circuit.pulled, let who = circuit.pulledByName {
                Text("Checked off by \(who).")
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
            }

            Text("CHANGE NOTE")
                .font(.caption2.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(FieldTheme.muted)
            ForEach(circuit.changeNotes.prefix(3)) { note in
                Text("\(note.text)  ·  \(note.createdByName)")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            TextField("What changed (optional)", text: Binding(
                get: { noteDraft[circuit.id] ?? "" },
                set: { noteDraft[circuit.id] = $0 }
            ))
            .textFieldStyle(.roundedBorder)
            Button("Add change note") {
                let text = noteDraft[circuit.id] ?? ""
                if board.addChangeNote(panelID: panel.id, circuitID: circuit.id, text: text, by: me) != nil {
                    noteDraft[circuit.id] = ""
                    error = nil
                    message = "Note saved on CKT \(circuit.number)."
                } else {
                    error = "Type a short change note first."
                    message = nil
                }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(FieldTheme.orange)
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func addCircuit(_ panel: PanelSchedule) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Add circuit")
            TextField("Circuit number", text: $newNumber)
                .keyboardType(.numbersAndPunctuation)
                .textFieldStyle(.roundedBorder)
            TextField("Load (optional)", text: $newDescription)
                .textFieldStyle(.roundedBorder)
            Button {
                if board.addCircuit(panelID: panel.id, number: newNumber, description: newDescription) != nil {
                    newNumber = ""
                    newDescription = ""
                    error = nil
                    message = "Circuit added on \(panel.name)."
                } else {
                    error = "Need a circuit number that is not already on \(panel.name)."
                    message = nil
                }
            } label: {
                Text("Add circuit")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(FieldTheme.orange)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var procoreStub: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Procore")
            Text("Import from Procore — later")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color.white.opacity(0.7))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
            Text("Disabled. No Procore login, API, or write in this cut.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
