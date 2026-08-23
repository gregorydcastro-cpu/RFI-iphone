import SwiftUI
import UniformTypeIdentifiers

struct PrintPhotoView: View {
    @StateObject private var model = PrintPhotoViewModel()
    @EnvironmentObject private var session: FieldSession
    @State private var showImporter = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Send print PDFs and job pictures to the foreman so he can see what is going on. Lands in the Foreman inbox. Not Procore. Do not invent a drawing number.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                VStack(alignment: .leading, spacing: 6) {
                    sectionLabel("Job")
                    Text(model.jobName)
                        .font(.headline)
                        .foregroundStyle(FieldTheme.ink)
                    Text("Sample / mock job only.")
                        .font(.caption)
                        .foregroundStyle(FieldTheme.muted)
                }

                VStack(alignment: .leading, spacing: 10) {
                    sectionLabel("Print PDFs")
                    Button {
                        showImporter = true
                    } label: {
                        Text("Add print PDF")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(FieldTheme.orange)
                    }
                    if model.prints.isEmpty {
                        Text("No prints yet. Import a PDF from Files.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    ForEach(model.prints) { print in
                        HStack {
                            Image(systemName: "doc.richtext")
                                .foregroundStyle(FieldTheme.orange)
                            Text(print.filename)
                                .font(.footnote)
                                .foregroundStyle(FieldTheme.ink)
                            Spacer()
                            Button(role: .destructive) {
                                model.removePrint(id: print.id)
                            } label: {
                                Image(systemName: "minus.circle")
                            }
                        }
                        .padding(10)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                    }
                }
                .fileImporter(
                    isPresented: $showImporter,
                    allowedContentTypes: [.pdf],
                    allowsMultipleSelection: true
                ) { result in
                    importPDFs(result)
                }

                PhotoStripView(
                    photos: $model.photos,
                    onAdd: { model.photos.append($0) },
                    onRemove: { photo in
                        model.photos.removeAll { $0.id == photo.id }
                    }
                )

                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("What is going on (optional)")
                    TextField("Area, what to look at", text: $model.note)
                        .textFieldStyle(.roundedBorder)
                }

                Button {
                    model.sendToForeman(session: session)
                } label: {
                    Text(session.sendTarget().map { "Send prints to \($0.name)" } ?? "Send prints to foreman")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(model.canSend(session: session) ? FieldTheme.orange : FieldTheme.orange.opacity(0.4))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!model.canSend(session: session))

                Text("The foreman opens this in the inbox and marks it up on this phone. Not a new ticket that skips the inbox.")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.muted)

                if let error = model.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                if let sent = model.sentPacket {
                    Text("Sent to \(sent.sentToName): \(sent.attachedPrints) print(s), \(sent.photoCount) photo(s).")
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0.16, green: 0.45, blue: 0.28))
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Prints")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    private func importPDFs(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            model.errorMessage = error.localizedDescription
        case .success(let urls):
            for url in urls {
                let access = url.startAccessingSecurityScopedResource()
                defer {
                    if access { url.stopAccessingSecurityScopedResource() }
                }
                if let data = try? Data(contentsOf: url) {
                    model.addPrint(filename: url.lastPathComponent, data: data)
                }
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
