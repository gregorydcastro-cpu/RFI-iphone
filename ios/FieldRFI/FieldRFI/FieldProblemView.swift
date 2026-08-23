import SwiftUI

struct FieldProblemView: View {
    @StateObject private var model = FieldProblemViewModel()
    @EnvironmentObject private var session: FieldSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                assignmentChrome
                VStack(alignment: .leading, spacing: 4) {
                    Text("Field problem")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(FieldTheme.orange)
                    Text("Pin or photo what is wrong. Send it to the foreman. This is not an RFI and not a Procore ticket.")
                        .font(.subheadline)
                        .foregroundStyle(FieldTheme.ink)
                }

                pickerBlock(title: "Project", value: model.selectedProject?.name ?? "Select a project") {
                    ForEach(model.projects) { project in
                        Button {
                            model.selectedProject = project
                            Task {
                                await model.loadRevisions()
                                await session.load(client: model.client, projectID: project.id)
                            }
                        } label: {
                            Label(project.name, systemImage: project.id == model.selectedProject?.id ? "checkmark" : "")
                        }
                    }
                }

                pickerBlock(title: "Sheet revision", value: model.selectedRevision?.pickerLabel ?? "Select a revision") {
                    ForEach(model.revisions) { revision in
                        Button {
                            model.selectedRevision = revision
                            model.pin = nil
                            Task { await model.loadDrawing() }
                        } label: {
                            Label(revision.pickerLabel, systemImage: revision.id == model.selectedRevision?.id ? "checkmark" : "")
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Print")
                    Text("Tap to pin. Uses the catalog revision. Do not type a drawing number.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                    DrawingCanvasView(imageData: model.drawingData, pin: model.pin) { x, y in
                        model.dropPin(xNorm: x, yNorm: y)
                    }
                    .frame(height: 280)
                    HStack {
                        Text("Grid / label")
                            .font(.subheadline)
                        TextField("B-4", text: $model.gridLabel)
                            .textInputAutocapitalization(.characters)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                PhotoStripView(photos: $model.photos, onAdd: { model.photos.append($0) }, onRemove: { photo in
                    model.photos.removeAll { $0.id == photo.id }
                })

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("What is wrong")
                    TextEditor(text: $model.note)
                        .frame(minHeight: 110)
                        .padding(8)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                }

                SendTargetPicker()
                Button {
                    model.sendToForeman(session: session)
                } label: {
                    Text(session.sendTarget().map { "Send to \($0.name)" } ?? "Send to foreman")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(model.canSend(session: session) ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!model.canSend(session: session))

                Text("The foreman orders or enters this in Procore later. This app does not submit a PO or set work-stopped.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)

                if let error = model.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                if let sent = model.sentPacket {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Sent to \(sent.sentToName)")
                            .font(.subheadline.weight(.semibold))
                        Text(sent.note)
                            .font(.footnote)
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
        .navigationTitle("Field problem")
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

    private var assignmentChrome: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Signed in")
            Menu {
                ForEach(session.crew) { member in
                    Button {
                        Task {
                            if let project = model.selectedProject {
                                await session.select(userID: member.user_id, client: model.client, projectID: project.id)
                            }
                        }
                    } label: {
                        Label(
                            "\(member.name)  ·  \(member.role.replacingOccurrences(of: "_", with: " "))",
                            systemImage: member.user_id == session.userID ? "checkmark" : ""
                        )
                    }
                }
            } label: {
                HStack {
                    Text(session.assignment.map { "\($0.name)  ·  \($0.role.replacingOccurrences(of: "_", with: " "))" } ?? "Select a seat")
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
            Text(session.banner)
                .font(.footnote)
                .foregroundStyle(FieldTheme.ink)
        }
    }

    private func pickerBlock<Content: View>(
        title: String,
        value: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel(title)
            Menu {
                content()
            } label: {
                HStack {
                    Text(value).foregroundStyle(FieldTheme.ink)
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
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
