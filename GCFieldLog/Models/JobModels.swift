import Foundation
import SwiftData

@Model
final class CrewMember {
    @Attribute(.unique) var id: UUID
    var name: String
    var roleRaw: String
    var pin: String
    var shortName: String

    var role: CrewRole {
        get { CrewRole(rawValue: roleRaw) ?? .apprentice }
        set { roleRaw = newValue.rawValue }
    }

    init(id: UUID = UUID(), name: String, role: CrewRole, pin: String, shortName: String) {
        self.id = id
        self.name = name
        self.roleRaw = role.rawValue
        self.pin = pin
        self.shortName = shortName
    }
}

@Model
final class Job {
    @Attribute(.unique) var id: UUID
    var name: String
    var jobNumber: String
    var siteLabel: String
    var isFictionalDemo: Bool
    var currentFloor: String

    @Relationship(deleteRule: .cascade, inverse: \DrawingSheet.job)
    var sheets: [DrawingSheet]

    @Relationship(deleteRule: .cascade, inverse: \MaterialLine.job)
    var materials: [MaterialLine]

    @Relationship(deleteRule: .cascade, inverse: \FieldProblem.job)
    var problems: [FieldProblem]

    @Relationship(deleteRule: .cascade, inverse: \RFIPacket.job)
    var rfis: [RFIPacket]

    @Relationship(deleteRule: .cascade, inverse: \JobTool.job)
    var tools: [JobTool]

    @Relationship(deleteRule: .cascade, inverse: \TimeEntry.job)
    var timeEntries: [TimeEntry]

    @Relationship(deleteRule: .cascade, inverse: \Panel.job)
    var panels: [Panel]

    @Relationship(deleteRule: .cascade, inverse: \AsBuiltMark.job)
    var redlines: [AsBuiltMark]

    @Relationship(deleteRule: .cascade, inverse: \RoomProgress.job)
    var rooms: [RoomProgress]

    @Relationship(deleteRule: .cascade, inverse: \GrabListSend.job)
    var grabSends: [GrabListSend]

    init(
        id: UUID = UUID(),
        name: String,
        jobNumber: String,
        siteLabel: String,
        currentFloor: String
    ) {
        self.id = id
        self.name = name
        self.jobNumber = jobNumber
        self.siteLabel = siteLabel
        self.isFictionalDemo = true
        self.currentFloor = currentFloor
        self.sheets = []
        self.materials = []
        self.problems = []
        self.rfis = []
        self.tools = []
        self.timeEntries = []
        self.panels = []
        self.redlines = []
        self.rooms = []
        self.grabSends = []
    }
}

@Model
final class DrawingSheet {
    @Attribute(.unique) var id: UUID
    var number: String
    var title: String
    var revision: Int
    var scaleText: String
    /// Paper inches. Demo plot is 24x36 full size.
    var pageWidthInches: Double
    var pageHeightInches: Double
    var isCurrentSet: Bool
    var receivedFromProcoreAt: Date?
    var job: Job?

    var displayName: String { "\(number) \(title) Rev \(revision)" }

    init(
        id: UUID = UUID(),
        number: String,
        title: String,
        revision: Int,
        scaleText: String,
        pageWidthInches: Double,
        pageHeightInches: Double,
        isCurrentSet: Bool,
        receivedFromProcoreAt: Date? = nil
    ) {
        self.id = id
        self.number = number
        self.title = title
        self.revision = revision
        self.scaleText = scaleText
        self.pageWidthInches = pageWidthInches
        self.pageHeightInches = pageHeightInches
        self.isCurrentSet = isCurrentSet
        self.receivedFromProcoreAt = receivedFromProcoreAt
    }
}

@Model
final class MaterialLine {
    @Attribute(.unique) var id: UUID
    var itemDescription: String
    var quantity: Double
    var unit: String
    var statusRaw: String
    var sourceLabel: String
    var packingSlipNote: String
    var receivedQuantity: Double
    var stillOutQuantity: Double
    var createdAt: Date
    var job: Job?

    var status: MaterialStatus {
        get { MaterialStatus(rawValue: statusRaw) ?? .needed }
        set { statusRaw = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        itemDescription: String,
        quantity: Double,
        unit: String = "ea",
        status: MaterialStatus,
        sourceLabel: String,
        packingSlipNote: String = "",
        receivedQuantity: Double = 0,
        stillOutQuantity: Double = 0
    ) {
        self.id = id
        self.itemDescription = itemDescription
        self.quantity = quantity
        self.unit = unit
        self.statusRaw = status.rawValue
        self.sourceLabel = sourceLabel
        self.packingSlipNote = packingSlipNote
        self.receivedQuantity = receivedQuantity
        self.stillOutQuantity = stillOutQuantity
        self.createdAt = .now
    }
}

@Model
final class FieldProblem {
    @Attribute(.unique) var id: UUID
    var title: String
    var notes: String
    var location: String
    var statusRaw: String
    var createdAt: Date
    var reporterName: String
    var job: Job?

    var status: ProblemStatus {
        get { ProblemStatus(rawValue: statusRaw) ?? .open }
        set { statusRaw = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        title: String,
        notes: String,
        location: String,
        status: ProblemStatus,
        reporterName: String
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.location = location
        self.statusRaw = status.rawValue
        self.createdAt = .now
        self.reporterName = reporterName
    }
}

@Model
final class RFIPacket {
    @Attribute(.unique) var id: UUID
    var question: String
    var suggestedSpecRef: String
    var pinLabel: String
    var sheetDisplayName: String
    var sheetRevision: Int
    var statusRaw: String
    var createdAt: Date
    var authorName: String
    var photoCount: Int
    var sentToName: String?
    /// Never submitted to Procore from this app. Foreman files it.
    var filedInProcore: Bool
    var job: Job?

    var status: RFIPacketStatus {
        get { RFIPacketStatus(rawValue: statusRaw) ?? .draft }
        set { statusRaw = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        question: String,
        suggestedSpecRef: String,
        pinLabel: String,
        sheetDisplayName: String,
        sheetRevision: Int,
        status: RFIPacketStatus,
        authorName: String,
        photoCount: Int = 1,
        sentToName: String? = nil
    ) {
        self.id = id
        self.question = question
        self.suggestedSpecRef = suggestedSpecRef
        self.pinLabel = pinLabel
        self.sheetDisplayName = sheetDisplayName
        self.sheetRevision = sheetRevision
        self.statusRaw = status.rawValue
        self.createdAt = .now
        self.authorName = authorName
        self.photoCount = photoCount
        self.sentToName = sentToName
        self.filedInProcore = false
    }
}

@Model
final class JobTool {
    @Attribute(.unique) var id: UUID
    var name: String
    var kindLabel: String
    var floor: String
    var holderName: String?
    var reservedForName: String?
    var reservedDate: Date?
    var job: Job?

    var availability: ToolAvailability {
        if holderName != nil { return .checkedOut }
        if reservedForName != nil { return .reserved }
        return .available
    }

    init(
        id: UUID = UUID(),
        name: String,
        kindLabel: String,
        floor: String,
        holderName: String? = nil,
        reservedForName: String? = nil,
        reservedDate: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.kindLabel = kindLabel
        self.floor = floor
        self.holderName = holderName
        self.reservedForName = reservedForName
        self.reservedDate = reservedDate
    }
}

@Model
final class TimeEntry {
    @Attribute(.unique) var id: UUID
    var workerName: String
    var workerID: UUID
    var day: Date
    var hours: Double
    var sourceRaw: String
    var note: String
    var job: Job?

    var source: TimeSource {
        get { TimeSource(rawValue: sourceRaw) ?? .punch }
        set { sourceRaw = newValue.rawValue }
    }

    var isOvertime: Bool { hours > 8 }

    var regularHours: Double { min(hours, 8) }
    var otHours: Double { max(0, hours - 8) }

    init(
        id: UUID = UUID(),
        workerName: String,
        workerID: UUID,
        day: Date,
        hours: Double,
        source: TimeSource,
        note: String = ""
    ) {
        self.id = id
        self.workerName = workerName
        self.workerID = workerID
        self.day = Calendar.current.startOfDay(for: day)
        self.hours = hours
        self.sourceRaw = source.rawValue
        self.note = note
    }
}

@Model
final class Panel {
    @Attribute(.unique) var id: UUID
    var name: String
    var location: String
    var voltage: String
    var job: Job?

    @Relationship(deleteRule: .cascade, inverse: \PanelCircuit.panel)
    var circuits: [PanelCircuit]

    init(id: UUID = UUID(), name: String, location: String, voltage: String) {
        self.id = id
        self.name = name
        self.location = location
        self.voltage = voltage
        self.circuits = []
    }
}

@Model
final class PanelCircuit {
    @Attribute(.unique) var id: UUID
    var number: Int
    var loadName: String
    var breakerAmps: Int
    var poles: Int
    var roomName: String
    var panel: Panel?

    init(id: UUID = UUID(), number: Int, loadName: String, breakerAmps: Int, poles: Int, roomName: String) {
        self.id = id
        self.number = number
        self.loadName = loadName
        self.breakerAmps = breakerAmps
        self.poles = poles
        self.roomName = roomName
    }
}

@Model
final class AsBuiltMark {
    @Attribute(.unique) var id: UUID
    var note: String
    var authorName: String
    var normalizedX: Double
    var normalizedY: Double
    var createdAt: Date
    var bumpedToGF: Bool
    var job: Job?

    init(
        id: UUID = UUID(),
        note: String,
        authorName: String,
        normalizedX: Double,
        normalizedY: Double,
        bumpedToGF: Bool = false
    ) {
        self.id = id
        self.note = note
        self.authorName = authorName
        self.normalizedX = normalizedX
        self.normalizedY = normalizedY
        self.createdAt = .now
        self.bumpedToGF = bumpedToGF
    }
}

@Model
final class RoomProgress {
    @Attribute(.unique) var id: UUID
    var name: String
    var fixtureKind: String
    var counted: Int
    var installed: Int
    var job: Job?

    var remaining: Int { max(0, counted - installed) }

    init(id: UUID = UUID(), name: String, fixtureKind: String, counted: Int, installed: Int) {
        self.id = id
        self.name = name
        self.fixtureKind = fixtureKind
        self.counted = counted
        self.installed = installed
    }
}

@Model
final class GrabListSend {
    @Attribute(.unique) var id: UUID
    var recipientNames: [String]
    var note: String
    var itemSummary: String
    var sentAt: Date
    var job: Job?

    init(id: UUID = UUID(), recipientNames: [String], note: String, itemSummary: String) {
        self.id = id
        self.recipientNames = recipientNames
        self.note = note
        self.itemSummary = itemSummary
        self.sentAt = .now
    }
}

@Model
final class BumpRecord {
    @Attribute(.unique) var id: UUID
    var kindRaw: String
    var fromDevice: String
    var toDevice: String
    var summary: String
    var createdAt: Date
    var applied: Bool
    var queuedOffline: Bool

    var kind: BumpKind {
        get { BumpKind(rawValue: kindRaw) ?? .endOfDayDump }
        set { kindRaw = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        kind: BumpKind,
        fromDevice: String,
        toDevice: String,
        summary: String,
        applied: Bool,
        queuedOffline: Bool
    ) {
        self.id = id
        self.kindRaw = kind.rawValue
        self.fromDevice = fromDevice
        self.toDevice = toDevice
        self.summary = summary
        self.createdAt = .now
        self.applied = applied
        self.queuedOffline = queuedOffline
    }
}

enum DemoIDs {
    static let job = UUID(uuidString: "A11E0001-0000-4000-8000-000000000001")!
    static let pat = UUID(uuidString: "A11E0001-0000-4000-8000-000000000011")!
    static let alex = UUID(uuidString: "A11E0001-0000-4000-8000-000000000012")!
    static let sam = UUID(uuidString: "A11E0001-0000-4000-8000-000000000013")!
    static let jordan = UUID(uuidString: "A11E0001-0000-4000-8000-000000000014")!
    static let sheetCurrent = UUID(uuidString: "A11E0001-0000-4000-8000-000000000021")!
    static let sheetOld = UUID(uuidString: "A11E0001-0000-4000-8000-000000000022")!
}

enum SchemaModels {
    static var schema: Schema {
        let types: [any PersistentModel.Type] = [
            CrewMember.self,
            Job.self,
            DrawingSheet.self,
            MaterialLine.self,
            FieldProblem.self,
            RFIPacket.self,
            JobTool.self,
            TimeEntry.self,
            Panel.self,
            PanelCircuit.self,
            AsBuiltMark.self,
            RoomProgress.self,
            GrabListSend.self,
            BumpRecord.self
        ]
        return Schema(types)
    }
}
