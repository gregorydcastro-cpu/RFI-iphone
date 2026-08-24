import Foundation
import SwiftUI

@MainActor
final class MaterialAskViewModel: ObservableObject {
    @Published var flagNotes: [String: String] = [:]
    @Published var errorMessage: String?
    @Published var sentPacket: FieldPacket?
    @Published var takeoffMessage: String?

    let uoms = MaterialBoard.uoms
    private let board = MaterialBoard.shared

    func canOrder(session: FieldSession) -> Bool {
        !session.isApprentice
    }

    func canSend(session: FieldSession) -> Bool {
        canOrder(session: session)
            && FeatureSettings.shared.allowsSend(session.userID)
            && session.sendTarget() != nil
            && !board.held.readyLines.isEmpty
    }

    func canPick(session: FieldSession) -> Bool {
        session.isApprentice || session.assignment == nil || session.canHandleMaterial
    }

    func canFlag(session: FieldSession) -> Bool {
        canPick(session: session)
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
        board.adoptSelectedJob()
        objectWillChange.send()
    }

    func runTakeoff() {
        switch GrokTakeoff.run(job: ShopSampleCatalog.selected) {
        case .success(let result):
            if board.applyTakeoff(result.lines, note: result.message) {
                takeoffMessage = result.message
                errorMessage = nil
            } else {
                errorMessage = "Takeoff did not write quantities."
            }
        case .failure(let failure):
            takeoffMessage = nil
            errorMessage = failure.message
        }
        objectWillChange.send()
    }

    func sendToForeman(session: FieldSession) {
        guard canOrder(session: session) else {
            errorMessage = "Apprentices pick up material. They do not order or submit."
            return
        }
        guard FeatureSettings.shared.allowsSend(session.userID) else {
            errorMessage = "The person above blocked send-to-inbox for this seat."
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
        guard board.flagBackOrder(id: id, note: note, session: session) else {
            errorMessage = "Could not flag the back-order."
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
