import Foundation
import SwiftUI

@MainActor
final class MaterialAskViewModel: ObservableObject {
    @Published var flagNotes: [String: String] = [:]
    @Published var errorMessage: String?
    @Published var sentPacket: FieldPacket?

    let uoms = MaterialBoard.uoms
    private let board = MaterialBoard.shared

    func canOrder(session: FieldSession) -> Bool {
        !session.isApprentice
    }

    func canSend(session: FieldSession) -> Bool {
        canOrder(session: session)
            && session.sendTarget() != nil
            && !board.held.readyLines.isEmpty
    }

    func canPick(session: FieldSession) -> Bool {
        session.isApprentice || session.assignment == nil || session.canHandleMaterial
    }

    func canFlag(session: FieldSession) -> Bool {
        session.sendTarget() != nil
    }

    func addLine() {
        board.addLine()
        objectWillChange.send()
    }

    func removeLine(id: String) {
        board.removeLine(id: id)
        objectWillChange.send()
    }

    func persistHeld() {
        board.save()
        objectWillChange.send()
    }

    func appear(session: FieldSession) {
        board.ensureAuthor(session: session)
        objectWillChange.send()
    }

    func sendToForeman(session: FieldSession) {
        guard canOrder(session: session) else {
            errorMessage = "Apprentices pick up material. They do not order or submit."
            return
        }
        guard let packet = board.sendHeld(session: session) else {
            errorMessage = board.held.readyLines.isEmpty
                ? "Add at least one line: description, qty, and UOM."
                : "No foreman on this crew."
            return
        }
        sentPacket = packet
        errorMessage = nil
        objectWillChange.send()
    }

    func flagBackOrder(id: String, session: FieldSession) {
        let note = flagNotes[id] ?? ""
        guard board.flagBackOrder(id: id, note: note, session: session) != nil else {
            errorMessage = "Could not send the back-order to the foreman."
            return
        }
        errorMessage = nil
        objectWillChange.send()
    }

    func markPicked(id: String) {
        board.markPicked(id: id)
        objectWillChange.send()
    }
}
