import SwiftUI
import UIKit

/// Foreman markup on a print/photo packet already in the inbox.
/// Highlight when something is done. Mock notes stay on this phone. Not Procore.
struct PrintMarkupView: View {
    let packet: FieldPacket
    @ObservedObject private var store = FieldAttachmentStore.shared
    @State private var selectedID: String?
    @State private var pageIndex = 0
    @State private var selectedMarkID: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Mark up this inbox packet. Highlight when something is done. Mock it up for yourself. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)
                Text(packet.note.isEmpty ? packet.projectName : packet.note)
                    .font(.headline)
                    .foregroundStyle(FieldTheme.ink)

                let files = store.attachments(for: packet.id)
                if files.isEmpty {
                    Text("No prints or photos on this packet.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(files) { file in
                                Button {
                                    selectedID = file.id
                                    pageIndex = 0
                                } label: {
                                    Text(file.filename)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(file.id == currentID ? FieldTheme.orange : Color.white)
                                        .foregroundStyle(file.id == currentID ? Color.white : FieldTheme.ink)
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }

                    if let file = currentFile {
                        if file.kind == .pdf, store.pageCount(for: file) > 1 {
                            Stepper("Page \(pageIndex + 1) of \(store.pageCount(for: file))", value: $pageIndex, in: 0...(store.pageCount(for: file) - 1))
                                .font(.footnote)
                        }
                        markupCanvas(file)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("MARKS")
                        .font(.caption.weight(.semibold))
                        .tracking(0.8)
                        .foregroundStyle(FieldTheme.muted)
                    let marks = store.marks(for: packet.id).filter { $0.attachmentID == currentID }
                    if marks.isEmpty {
                        Text("Tap the print to drop a highlight. Tap a highlight to mark it done.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    ForEach(marks) { mark in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(mark.done ? "Done" : "Open")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(mark.done ? Color(red: 0.16, green: 0.45, blue: 0.28) : FieldTheme.orange)
                                Spacer()
                                Button(mark.done ? "Still open" : "Mark done") {
                                    store.toggleDone(id: mark.id, packetID: packet.id)
                                }
                                .font(.caption.weight(.semibold))
                            }
                            TextField("Mock note for yourself", text: noteBinding(mark))
                                .textFieldStyle(.roundedBorder)
                        }
                        .padding(10)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                    }
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Mark up")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            if selectedID == nil {
                selectedID = store.attachments(for: packet.id).first?.id
            }
        }
    }

    private var currentID: String? {
        selectedID ?? store.attachments(for: packet.id).first?.id
    }

    private var currentFile: FieldAttachment? {
        store.attachments(for: packet.id).first(where: { $0.id == currentID })
    }

    private func markupCanvas(_ file: FieldAttachment) -> some View {
        let marks = store.marks(for: packet.id).filter {
            $0.attachmentID == file.id && $0.pageIndex == pageIndex
        }
        return GeometryReader { geo in
            ZStack {
                if let image = store.previewImage(for: file, page: pageIndex) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)
                } else {
                    Rectangle().fill(Color.white)
                }
                ForEach(marks) { mark in
                    Rectangle()
                        .fill(mark.done
                              ? Color(red: 0.16, green: 0.45, blue: 0.28).opacity(0.40)
                              : Color.yellow.opacity(0.45))
                        .frame(width: geo.size.width * mark.wNorm, height: geo.size.height * mark.hNorm)
                        .position(x: geo.size.width * mark.xNorm, y: geo.size.height * mark.yNorm)
                        .onTapGesture {
                            store.toggleDone(id: mark.id, packetID: packet.id)
                            selectedMarkID = mark.id
                        }
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0).onEnded { value in
                    guard geo.size.width > 0, geo.size.height > 0 else { return }
                    let x = min(max(value.location.x / geo.size.width, 0.08), 0.92)
                    let y = min(max(value.location.y / geo.size.height, 0.06), 0.94)
                    let mark = PrintMarkup(
                        id: UUID().uuidString,
                        attachmentID: file.id,
                        pageIndex: pageIndex,
                        xNorm: x,
                        yNorm: y,
                        wNorm: 0.18,
                        hNorm: 0.08,
                        note: "",
                        done: false
                    )
                    store.addMark(mark, packetID: packet.id)
                    selectedMarkID = mark.id
                }
            )
        }
        .frame(height: 360)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func noteBinding(_ mark: PrintMarkup) -> Binding<String> {
        Binding(
            get: { mark.note },
            set: { text in
                var next = mark
                next.note = text
                store.updateMark(next, packetID: packet.id)
            }
        )
    }
}
