import Foundation
import SwiftData
import SwiftUI

@Observable
final class SessionController {
    var signedInID: UUID
    var pinSessionID: UUID?
    var activeJobID: UUID
    var activeSheetID: UUID
    var destination: AppDestination
    var lastTakeoff: TakeoffResult?
    var selectedZoneName: String = "Office"
    var showPINPad = false
    var toast: String?

    init(
        signedInID: UUID = DemoIDs.pat,
        activeJobID: UUID = DemoIDs.job,
        activeSheetID: UUID = DemoIDs.sheetCurrent,
        destination: AppDestination = .count
    ) {
        self.signedInID = signedInID
        self.activeJobID = activeJobID
        self.activeSheetID = activeSheetID
        self.destination = destination
    }

    var effectiveID: UUID { pinSessionID ?? signedInID }
    var isPINSession: Bool { pinSessionID != nil }

    func member(from crew: [CrewMember]) -> CrewMember? {
        crew.first { $0.id == effectiveID }
    }

    func signedIn(from crew: [CrewMember]) -> CrewMember? {
        crew.first { $0.id == signedInID }
    }

    func switchAccount(to member: CrewMember) {
        signedInID = member.id
        pinSessionID = nil
        toast = "Signed in as \(member.name)"
    }

    func startPINSession(member: CrewMember) {
        pinSessionID = member.id
        showPINPad = false
        if !destination.allowedDuringPINSession {
            destination = .time
        }
        toast = "\(member.name) on the job iPad — punch or check a tool, then it flips back."
    }

    func endPINSession(returningTo name: String) {
        pinSessionID = nil
        toast = "iPad back with \(name)."
    }

    func flash(_ message: String) {
        toast = message
    }
}
