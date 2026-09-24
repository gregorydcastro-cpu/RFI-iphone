import Foundation
import SwiftUI

enum CrewRole: String, Codable, CaseIterable, Identifiable {
    case generalForeman
    case foreman
    case journeyman
    case apprentice

    var id: String { rawValue }

    var title: String {
        switch self {
        case .generalForeman: "General Foreman"
        case .foreman: "Foreman"
        case .journeyman: "Journeyman"
        case .apprentice: "Apprentice"
        }
    }

    var shortTitle: String {
        switch self {
        case .generalForeman: "GF"
        case .foreman: "Foreman"
        case .journeyman: "JW"
        case .apprentice: "Appr"
        }
    }

    var symbol: String {
        switch self {
        case .generalForeman: "star.circle.fill"
        case .foreman: "person.badge.shield.checkmark.fill"
        case .journeyman: "person.fill"
        case .apprentice: "person"
        }
    }

    var canComposeRFI: Bool { self == .foreman || self == .journeyman || self == .generalForeman }
    var canFixTime: Bool { self == .foreman || self == .generalForeman }
    var canSendGrabList: Bool { self == .foreman || self == .generalForeman }
    var canOrderMaterial: Bool { self == .foreman || self == .generalForeman }
    var canRunCount: Bool { self != .apprentice }
    var canHandoffJob: Bool { self == .foreman || self == .generalForeman }
}

enum MaterialStatus: String, Codable, CaseIterable, Identifiable {
    case needed
    case grabIt
    case ordered
    case backordered
    case onSite

    var id: String { rawValue }

    var title: String {
        switch self {
        case .needed: "Needed"
        case .grabIt: "Grab it"
        case .ordered: "Ordered"
        case .backordered: "Backordered"
        case .onSite: "On site"
        }
    }

    var symbol: String {
        switch self {
        case .needed: "cart"
        case .grabIt: "shippingbox"
        case .ordered: "truck.box"
        case .backordered: "exclamationmark.triangle.fill"
        case .onSite: "checkmark.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .needed: GCTheme.needed
        case .grabIt: GCTheme.grab
        case .ordered: GCTheme.ordered
        case .backordered: GCTheme.backorder
        case .onSite: GCTheme.onSite
        }
    }

    var isLoud: Bool { self == .backordered }
}

enum ProblemStatus: String, Codable, CaseIterable, Identifiable {
    case open, inProgress, resolved
    var id: String { rawValue }
    var title: String {
        switch self {
        case .open: "Open"
        case .inProgress: "Working"
        case .resolved: "Resolved"
        }
    }
    var tint: Color {
        switch self {
        case .open: GCTheme.backorder
        case .inProgress: GCTheme.grab
        case .resolved: GCTheme.onSite
        }
    }
}

enum RFIPacketStatus: String, Codable, CaseIterable, Identifiable {
    case draft
    case readyForForeman
    case sentToForeman
    var id: String { rawValue }
    var title: String {
        switch self {
        case .draft: "Draft"
        case .readyForForeman: "Ready — send to foreman"
        case .sentToForeman: "With foreman (file in Procore)"
        }
    }
}

enum ToolAvailability: String, Codable {
    case available, checkedOut, reserved
}

enum TimeSource: String, Codable {
    case punch, signInSheet, foremanEdit
}

enum BumpKind: String, Codable, CaseIterable, Identifiable {
    case morningAssignment
    case endOfDayDump
    case jobHandoff
    case inspectionReady
    case asBuiltRedlines

    var id: String { rawValue }

    var title: String {
        switch self {
        case .morningAssignment: "Morning assignment"
        case .endOfDayDump: "End of day dump"
        case .jobHandoff: "Job handoff"
        case .inspectionReady: "Inspection-ready"
        case .asBuiltRedlines: "As-built redlines"
        }
    }

    var detail: String {
        switch self {
        case .morningAssignment: "Floor, sheet, grab list, and tools — bumped to each worker."
        case .endOfDayDump: "Time, leftover material, tool returns, RFIs, and problems onto the job iPad."
        case .jobHandoff: "Current prints, panel schedules, material, tools out, open RFIs."
        case .inspectionReady: "Push the ready package to the GF. Not a Procore submit."
        case .asBuiltRedlines: "Redlines on the sheet, bumped to the GF."
        }
    }

    var symbol: String {
        switch self {
        case .morningAssignment: "sunrise.fill"
        case .endOfDayDump: "moon.stars.fill"
        case .jobHandoff: "arrow.triangle.swap"
        case .inspectionReady: "checkmark.seal.fill"
        case .asBuiltRedlines: "pencil.tip.crop.circle"
        }
    }
}

enum SymbolKind: String, Codable, CaseIterable, Identifiable {
    case troffer2x4
    case downlight
    case duplex
    case switchToggle
    case gfci

    var id: String { rawValue }

    var title: String {
        switch self {
        case .troffer2x4: "2x4 troffer"
        case .downlight: "Downlight"
        case .duplex: "Duplex receptacle"
        case .switchToggle: "Switch"
        case .gfci: "GFCI receptacle"
        }
    }

    var plural: String {
        switch self {
        case .troffer2x4: "2x4 troffers"
        case .downlight: "Downlights"
        case .duplex: "Duplex receptacles"
        case .switchToggle: "Switches"
        case .gfci: "GFCI receptacles"
        }
    }
}

enum AppDestination: String, CaseIterable, Identifiable, Hashable {
    case rfi, problem, material, foreman, count, tools, time

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rfi: "RFI"
        case .problem: "Problem"
        case .material: "Material"
        case .foreman: "Foreman"
        case .count: "Count"
        case .tools: "Tools"
        case .time: "Time"
        }
    }

    var symbol: String {
        switch self {
        case .rfi: "questionmark.bubble"
        case .problem: "exclamationmark.triangle"
        case .material: "shippingbox"
        case .foreman: "person.badge.shield.checkmark"
        case .count: "chart.bar"
        case .tools: "wrench.and.screwdriver"
        case .time: "clock"
        }
    }

    /// Destinations a PIN-switched apprentice/journeyman may use on the shared iPad.
    var allowedDuringPINSession: Bool {
        self == .time || self == .tools || self == .material
    }
}
