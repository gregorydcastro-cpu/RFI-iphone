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
                Text("Field tracker on \(ShopCrew.jobName). Pulled vs not pulled so a circuit is not missed. Build the list here. Not a design log. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                ShopSeatPicker()

                createPanel
                panelList

                if let panel {
                    panelDetail(panel)
                }

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                if let message {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                }

                Text("On this phone. Not a Procore import.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
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
            sectionLabel("Build a panel")
            TextField("Panel name", text: $newPanelName)
                .textFieldStyle(.roundedBorder)
            Button {
                if let row = board.createPanel(name: newPanelName) {
                    selectedID = row.id
                    newPanelName = ""
                    error = nil
                    message = "\(row.name) on \(row.jobName)."
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
            Text("\(ShopCrew.jobName) · \(ShopSampleCatalog.sheetNumber) Rev \(ShopSampleCatalog.revision) only.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
        }
    }

    private var panelList: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("On \(ShopCrew.jobName)")
            if board.panels.isEmpty {
                Text("No panels yet. Create one, then add circuits or fill from E-101 Rev A.")
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
                            Text("\(row.pulledCount) pulled · \(row.circuits.count - row.pulledCount) not pulled")
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
            Text("\(panel.name)  ·  \(panel.pulledCount) of \(panel.circuits.count) pulled")
                .font(.headline)
                .foregroundStyle(FieldTheme.ink)

            if features.flags(for: session.userID).takeoff {
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
                Text("Optional. Writes nothing if the sample sheet is missing.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }

            circuitList(panel)
            addCircuit(panel)
        }
    }

    private func circuitList(_ panel: PanelSchedule) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Circuits")
            if panel.circuits.isEmpty {
                Text("Nothing to track yet. Add a circuit or fill from the sample.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.muted)
            }
            ForEach(panel.circuits) { circuit in
                circuitRow(panel, circuit)
            }
        }
    }

    private func circuitRow(_ panel: PanelSchedule, _ circuit: PanelCircuit) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    TextField("CKT", text: Binding(
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
                }
                Toggle(circuit.pulled ? "Pulled" : "Not pulled", isOn: Binding(
                    get: { circuit.pulled },
                    set: { board.setPulled(panelID: panel.id, circuitID: circuit.id, pulled: $0, by: me) }
                ))
                .labelsHidden()
                .tint(FieldTheme.orange)
            }
            HStack {
                Text(circuit.pulled ? "pulled" : "not pulled")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(circuit.pulled
                                     ? Color(red: 0.16, green: 0.45, blue: 0.28)
                                     : FieldTheme.orange)
                Spacer()
                Button("Save") {
                    let number = editNumber[circuit.id] ?? circuit.number
                    let description = editDescription[circuit.id] ?? circuit.description
                    if board.editCircuit(panelID: panel.id, circuitID: circuit.id, number: number, description: description) {
                        error = nil
                        message = nil
                    } else {
                        error = "Circuit number is empty or already on \(panel.name)."
                        message = nil
                    }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(FieldTheme.orange)
            }
            if let last = circuit.changeNotes.first {
                Text(last.text)
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)
            }
            HStack {
                TextField("Note (optional)", text: Binding(
                    get: { noteDraft[circuit.id] ?? "" },
                    set: { noteDraft[circuit.id] = $0 }
                ))
                .textFieldStyle(.roundedBorder)
                Button("Note") {
                    let text = noteDraft[circuit.id] ?? ""
                    if board.addChangeNote(panelID: panel.id, circuitID: circuit.id, text: text, by: me) != nil {
                        noteDraft[circuit.id] = ""
                        error = nil
                    } else {
                        error = "Type a short note first."
                    }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(FieldTheme.orange)
            }
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func addCircuit(_ panel: PanelSchedule) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Add circuit")
            HStack {
                TextField("CKT", text: $newNumber)
                    .keyboardType(.numbersAndPunctuation)
                    .textFieldStyle(.roundedBorder)
                TextField("Load", text: $newDescription)
                    .textFieldStyle(.roundedBorder)
            }
            Button {
                if board.addCircuit(panelID: panel.id, number: newNumber, description: newDescription) != nil {
                    newNumber = ""
                    newDescription = ""
                    error = nil
                    message = "Circuit on \(panel.name)."
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

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
