import Foundation
import SwiftUI
import UIKit
import PDFKit

enum FieldAttachmentKind: String, Codable {
    case pdf
    case jpeg
}

struct FieldAttachment: Identifiable, Codable, Hashable {
    var id: String
    var packetID: String
    var kind: FieldAttachmentKind
    var filename: String
}

struct PrintMarkup: Identifiable, Codable, Hashable {
    var id: String
    var attachmentID: String
    var pageIndex: Int
    var xNorm: Double
    var yNorm: Double
    var wNorm: Double
    var hNorm: Double
    var note: String
    var done: Bool
}

/// Local files for prints and job pictures. Not Procore. Stays on this phone.
@MainActor
final class FieldAttachmentStore: ObservableObject {
    static let shared = FieldAttachmentStore()

    @Published private(set) var index: [FieldAttachment] = []

    private let indexKey = "gcfieldlog.attachments.v1"
    private let markupKey = "gcfieldlog.markup.v1"

    private var markup: [String: [PrintMarkup]] = [:]

    init() {
        load()
    }

    func attachments(for packetID: String) -> [FieldAttachment] {
        index.filter { $0.packetID == packetID }
    }

    func marks(for packetID: String) -> [PrintMarkup] {
        markup[packetID] ?? []
    }

    func fileURL(for attachment: FieldAttachment) -> URL {
        folder.appendingPathComponent("\(attachment.id)-\(attachment.filename)")
    }

    func data(for attachment: FieldAttachment) -> Data? {
        try? Data(contentsOf: fileURL(for: attachment))
    }

    @discardableResult
    func save(packetID: String, kind: FieldAttachmentKind, filename: String, data: Data) -> FieldAttachment {
        let row = FieldAttachment(
            id: UUID().uuidString,
            packetID: packetID,
            kind: kind,
            filename: filename
        )
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? data.write(to: fileURL(for: row), options: .atomic)
        index.append(row)
        persistIndex()
        return row
    }

    func addMark(_ mark: PrintMarkup, packetID: String) {
        var rows = markup[packetID] ?? []
        rows.append(mark)
        markup[packetID] = rows
        persistMarkup()
        objectWillChange.send()
    }

    func updateMark(_ mark: PrintMarkup, packetID: String) {
        var rows = markup[packetID] ?? []
        if let i = rows.firstIndex(where: { $0.id == mark.id }) {
            rows[i] = mark
            markup[packetID] = rows
            persistMarkup()
            objectWillChange.send()
        }
    }

    func toggleDone(id: String, packetID: String) {
        var rows = markup[packetID] ?? []
        if let i = rows.firstIndex(where: { $0.id == id }) {
            rows[i].done.toggle()
            markup[packetID] = rows
            persistMarkup()
            objectWillChange.send()
        }
    }

    func previewImage(for attachment: FieldAttachment, page: Int = 0) -> UIImage? {
        guard let data = data(for: attachment) else { return nil }
        if attachment.kind == .jpeg {
            return UIImage(data: data)
        }
        guard let doc = PDFDocument(data: data), let pdfPage = doc.page(at: page) else {
            return nil
        }
        let box = pdfPage.bounds(for: .mediaBox)
        let scale: CGFloat = 2
        let size = CGSize(width: max(box.width * scale, 1), height: max(box.height * scale, 1))
        return pdfPage.thumbnail(of: size, for: .mediaBox)
    }

    func pageCount(for attachment: FieldAttachment) -> Int {
        guard attachment.kind == .pdf, let data = data(for: attachment), let doc = PDFDocument(data: data) else {
            return 1
        }
        return max(doc.pageCount, 1)
    }

    private var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("gcfieldlog-attachments", isDirectory: true)
    }

    private func load() {
        if let data = UserDefaults.standard.data(forKey: indexKey),
           let rows = try? JSONDecoder().decode([FieldAttachment].self, from: data) {
            index = rows
        }
        if let data = UserDefaults.standard.data(forKey: markupKey),
           let rows = try? JSONDecoder().decode([String: [PrintMarkup]].self, from: data) {
            markup = rows
        }
    }

    private func persistIndex() {
        if let data = try? JSONEncoder().encode(index) {
            UserDefaults.standard.set(data, forKey: indexKey)
        }
    }

    private func persistMarkup() {
        if let data = try? JSONEncoder().encode(markup) {
            UserDefaults.standard.set(data, forKey: markupKey)
        }
    }
}
