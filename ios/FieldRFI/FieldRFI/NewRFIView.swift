import SwiftUI

struct NewRFIView: View {
    @StateObject private var model = NewRFIViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerNote
                pickerBlock(
                    title: "Project",
                    value: model.selectedProject?.name ?? "Select a project"
                ) {
                    ForEach(model.projects) { project in
                        Button {
                            model.selectedProject = project
                            Task { await model.loadRevisions() }
                        } label: {
                            Label(project.name, systemImage: project.id == model.selectedProject?.id ? "checkmark" : "")
                        }
                    }
                }

                pickerBlock(
                    title: "Sheet revision",
                    value: model.selectedRevision?.pickerLabel ?? "Select a revision"
                ) {
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
                    sectionLabel("Drawing")
                    Text("Tap the sheet to drop a pin. Coordinates are stored 0–1 on this revision, not a loose sheet number.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                    DrawingCanvasView(
                        imageData: model.drawingData,
                        pin: model.pin,
                        onDrop: { x, y in
                            model.dropPin(xNorm: x, yNorm: y)
                        }
                    )
                    .frame(height: 280)

                    HStack {
                        if let pin = model.pin {
                            Text(String(format: "Pin  x %.2f   y %.2f", pin.x_norm, pin.y_norm))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(FieldTheme.ink)
                        } else {
                            Text("No pin yet")
                                .font(.caption)
                                .foregroundStyle(FieldTheme.muted)
                        }
                        Spacer()
                    }

                    HStack {
                        Text("Grid / label")
                            .font(.subheadline)
                        TextField("B-4", text: $model.gridLabel)
                            .textInputAutocapitalization(.characters)
                            .textFieldStyle(.roundedBorder)
                            .onChange(of: model.gridLabel) { _, value in
                                if var pin = model.pin {
                                    pin.label = value.isEmpty ? nil : value
                                    model.pin = pin
                                }
                            }
                    }
                }

                PhotoStripView(
                    photos: $model.photos,
                    onAdd: model.addPhoto,
                    onRemove: model.removePhoto
                )

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Note")
                    Text("One question. Grokbot will cite the sheet, revision, and grid. An answer is not a CO.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                    TextEditor(text: $model.note)
                        .frame(minHeight: 110)
                        .padding(8)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(FieldTheme.rule, lineWidth: 1)
                        )
                }

                Button {
                    Task { await model.draftRFI() }
                } label: {
                    HStack {
                        if model.isDrafting {
                            ProgressView()
                                .tint(.white)
                        }
                        Text(model.isDrafting ? "Searching, then drafting…" : "Draft RFI")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(model.canDraft ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!model.canDraft)

                Text("Draft only. Searches this sheet, grid, or subject first. Does not submit, number, or set work_stopped.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)

                if let error = model.errorMessage {
                    banner(title: "Could not draft", body: error, tone: .error)
                }
                if let dup = model.duplicate {
                    banner(
                        title: "Open RFI already exists",
                        body: "\(dup.subject)\nStatus: \(dup.status)   Number: \(dup.rfi_display ?? "none")",
                        tone: .warning
                    )
                }
                if let result = model.draftResult, result.ok, let saved = model.savedRFI {
                    banner(
                        title: "Draft saved",
                        body: "Status: \(saved.status)\nDisplay number: \(saved.rfi_display ?? "null")\nMissing for submit: \(result.missing_for_submit.joined(separator: ", "))\n\n\(saved.subject)",
                        tone: .success
                    )
                }

                DisclosureGroup("Server") {
                    TextField("API base URL", text: $model.baseURLString)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .textFieldStyle(.roundedBorder)
                    Button("Reload catalog") {
                        Task { await model.loadCatalog() }
                    }
                }
                .font(.footnote)
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("New RFI")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await model.loadCatalog()
        }
    }

    private var headerNote: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Field / PM draft")
                .font(.caption.weight(.semibold))
                .foregroundStyle(FieldTheme.orange)
            Text("Pin a sheet revision, add photos and one note, then draft. Grokbot writes suggested_rfis or a draft — never a submitted RFI.")
                .font(.subheadline)
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
                    Text(value)
                        .foregroundStyle(FieldTheme.ink)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption.weight(.semibold))
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
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }

    private enum Tone { case error, warning, success }

    private func banner(title: String, body: String, tone: Tone) -> some View {
        let color: Color = switch tone {
        case .error: Color.red
        case .warning: FieldTheme.orange
        case .success: Color(red: 0.16, green: 0.45, blue: 0.28)
        }
        return VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(body)
                .font(.footnote)
        }
        .foregroundStyle(color)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

#Preview {
    NavigationStack {
        NewRFIView()
    }
}
