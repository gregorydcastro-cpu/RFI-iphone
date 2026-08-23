import SwiftUI

struct MaterialAskView: View {
    @StateObject private var model = MaterialAskViewModel()
    @EnvironmentObject private var session: FieldSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Draft list for the foreman. Not a PO. Not a Procore order.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Project")
                    Menu {
                        ForEach(model.projects) { project in
                            Button {
                                model.selectedProject = project
                                Task { await session.load(client: model.client, projectID: project.id) }
                            } label: {
                                Label(project.name, systemImage: project.id == model.selectedProject?.id ? "checkmark" : "")
                            }
                        }
                    } label: {
                        HStack {
                            Text(model.selectedProject?.name ?? "Select a project")
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

                VStack(alignment: .leading, spacing: 10) {
                    sectionLabel("Lines")
                    ForEach(model.lines.indices, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("What to buy", text: $model.lines[index].description)
                                .textFieldStyle(.roundedBorder)
                            HStack {
                                TextField("Qty", value: $model.lines[index].qty, format: .number)
                                    .keyboardType(.decimalPad)
                                    .textFieldStyle(.roundedBorder)
                                Picker("UOM", selection: $model.lines[index].uom) {
                                    ForEach(model.uoms, id: \.self) { Text($0).tag($0) }
                                }
                                .pickerStyle(.menu)
                                if model.lines.count > 1 {
                                    Button(role: .destructive) {
                                        model.removeLine(at: index)
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
                    Button("Add line", action: model.addLine)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FieldTheme.orange)
                }

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Note (optional)")
                    TextField("Where it goes, who needs it", text: $model.note)
                        .textFieldStyle(.roundedBorder)
                }

                Button {
                    model.sendToForeman(session: session)
                } label: {
                    Text(session.sendTarget().map { "Send draft list to \($0.name)" } ?? "Send draft list to foreman")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(model.canSend(session: session) ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!model.canSend(session: session))

                Text("Draft only. The foreman places the order later. Grokbot never submits a PO.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)

                if session.isApprentice {
                    Text("Apprentice: handle assigned tickets on the Material tab from New RFI if that is your lane. This list is an ask, not a ticket close.")
                        .font(.caption)
                        .foregroundStyle(FieldTheme.muted)
                }

                if let error = model.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                if let sent = model.sentPacket {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Draft list sent to \(sent.sentToName)")
                            .font(.subheadline.weight(.semibold))
                        ForEach(sent.materialLines, id: \.description) { line in
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
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Material")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await model.loadCatalog()
            if let project = model.selectedProject {
                await session.load(client: model.client, projectID: project.id)
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
