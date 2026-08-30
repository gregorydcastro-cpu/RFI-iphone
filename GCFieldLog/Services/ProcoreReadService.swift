import Foundation

struct ProcoreRevisionAlert: Identifiable, Hashable {
    var id: UUID
    var sheetDisplayName: String
    var oldRevision: Int
    var newRevision: Int
    var message: String
}

/// Read path only. The app may pull the current set. It never files RFIs or POs.
protocol ProcoreReading: Sendable {
    func currentSetAlerts(currentRevision: Int, previousRevision: Int, sheetName: String) -> [ProcoreRevisionAlert]
}

struct StubProcoreReadService: ProcoreReading {
    func currentSetAlerts(currentRevision: Int, previousRevision: Int, sheetName: String) -> [ProcoreRevisionAlert] {
        guard currentRevision > previousRevision else { return [] }
        return [
            ProcoreRevisionAlert(
                id: UUID(uuidString: "A11E0001-0000-4000-8000-000000000031")!,
                sheetDisplayName: sheetName,
                oldRevision: previousRevision,
                newRevision: currentRevision,
                message: "Procore set moved \(sheetName.components(separatedBy: " Rev").first ?? sheetName) from Rev \(previousRevision) to Rev \(currentRevision). Do not count yesterday's sheet."
            )
        ]
    }
}
