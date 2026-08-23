import Foundation
import SwiftUI

/// On-device access. Default allow. Assigned downward. Not a backend ABAC.
struct FeatureFlags: Codable, Equatable {
    var material: Bool = true
    var prints: Bool = true
    var takeoff: Bool = true
    var tasks: Bool = true
    var calendar: Bool = true
    var seeRFI: Bool = true
    var seeProblem: Bool = true
    var seeInbox: Bool = true
    var assign: Bool = true
    var send: Bool = true

    func mergingOff(_ other: FeatureFlags) -> FeatureFlags {
        FeatureFlags(
            material: material && other.material,
            prints: prints && other.prints,
            takeoff: takeoff && other.takeoff,
            tasks: tasks && other.tasks,
            calendar: calendar && other.calendar,
            seeRFI: seeRFI && other.seeRFI,
            seeProblem: seeProblem && other.seeProblem,
            seeInbox: seeInbox && other.seeInbox,
            assign: assign && other.assign,
            send: send && other.send
        )
    }

    init(
        material: Bool = true,
        prints: Bool = true,
        takeoff: Bool = true,
        tasks: Bool = true,
        calendar: Bool = true,
        seeRFI: Bool = true,
        seeProblem: Bool = true,
        seeInbox: Bool = true,
        assign: Bool = true,
        send: Bool = true
    ) {
        self.material = material
        self.prints = prints
        self.takeoff = takeoff
        self.tasks = tasks
        self.calendar = calendar
        self.seeRFI = seeRFI
        self.seeProblem = seeProblem
        self.seeInbox = seeInbox
        self.assign = assign
        self.send = send
    }

    enum CodingKeys: String, CodingKey {
        case material, prints, takeoff, tasks, calendar
        case seeRFI, seeProblem, seeInbox, assign, send
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        material = try c.decodeIfPresent(Bool.self, forKey: .material) ?? true
        prints = try c.decodeIfPresent(Bool.self, forKey: .prints) ?? true
        takeoff = try c.decodeIfPresent(Bool.self, forKey: .takeoff) ?? true
        tasks = try c.decodeIfPresent(Bool.self, forKey: .tasks) ?? true
        calendar = try c.decodeIfPresent(Bool.self, forKey: .calendar) ?? true
        seeRFI = try c.decodeIfPresent(Bool.self, forKey: .seeRFI) ?? true
        seeProblem = try c.decodeIfPresent(Bool.self, forKey: .seeProblem) ?? true
        seeInbox = try c.decodeIfPresent(Bool.self, forKey: .seeInbox) ?? true
        assign = try c.decodeIfPresent(Bool.self, forKey: .assign) ?? true
        send = try c.decodeIfPresent(Bool.self, forKey: .send) ?? true
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(material, forKey: .material)
        try c.encode(prints, forKey: .prints)
        try c.encode(takeoff, forKey: .takeoff)
        try c.encode(tasks, forKey: .tasks)
        try c.encode(calendar, forKey: .calendar)
        try c.encode(seeRFI, forKey: .seeRFI)
        try c.encode(seeProblem, forKey: .seeProblem)
        try c.encode(seeInbox, forKey: .seeInbox)
        try c.encode(assign, forKey: .assign)
        try c.encode(send, forKey: .send)
    }
}

@MainActor
final class FeatureSettings: ObservableObject {
    static let shared = FeatureSettings()

    @Published private(set) var byUser: [String: FeatureFlags] = [:]
    @Published private(set) var byRole: [String: FeatureFlags] = [:]

    private let key = "gcfieldlog.features.v2"

    init() {
        load()
    }

    func flags(for userID: String?) -> FeatureFlags {
        guard let member = ShopCrew.member(byID: userID) else { return FeatureFlags() }
        return flags(for: member)
    }

    func allowsAssign(_ userID: String?) -> Bool {
        let flags = flags(for: userID)
        return flags.tasks && flags.assign
    }

    func allowsSend(_ userID: String?) -> Bool {
        flags(for: userID).send
    }

    func flags(for member: CrewMemberDTO) -> FeatureFlags {
        var result = FeatureFlags()
        if let role = byRole[member.role] {
            result = result.mergingOff(role)
        }
        if let person = byUser[member.user_id] {
            return person
        }
        return result
    }

    func canAssign(from actorID: String?, toUser targetID: String) -> Bool {
        guard let actor = ShopCrew.member(byID: actorID),
              let target = ShopCrew.member(byID: targetID)
        else { return false }
        return ShopCrew.isBelow(target, of: actor)
    }

    func canAssign(from actorID: String?, toRole role: String) -> Bool {
        guard let actor = ShopCrew.member(byID: actorID) else { return false }
        return ShopCrew.below(actor).contains(where: { $0.role == role })
    }

    func set(_ flags: FeatureFlags, forUser userID: String, by actorID: String?) {
        guard canAssign(from: actorID, toUser: userID) else { return }
        byUser[userID] = flags
        save()
    }

    func set(_ flags: FeatureFlags, forRole role: String, by actorID: String?) {
        guard canAssign(from: actorID, toRole: role) else { return }
        byRole[role] = flags
        save()
    }

    func updateUser(_ userID: String, by actorID: String?, _ mutate: (inout FeatureFlags) -> Void) {
        guard let member = ShopCrew.member(byID: userID) else { return }
        var next = flags(for: member)
        mutate(&next)
        set(next, forUser: userID, by: actorID)
    }

    func updateRole(_ role: String, by actorID: String?, _ mutate: (inout FeatureFlags) -> Void) {
        var next = byRole[role] ?? FeatureFlags()
        mutate(&next)
        set(next, forRole: role, by: actorID)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let box = try? JSONDecoder().decode(Box.self, from: data)
        else { return }
        byUser = box.byUser
        byRole = box.byRole
    }

    private func save() {
        let box = Box(byUser: byUser, byRole: byRole)
        if let data = try? JSONEncoder().encode(box) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }

    private struct Box: Codable {
        var byUser: [String: FeatureFlags]
        var byRole: [String: FeatureFlags]
    }
}

struct FeatureSettingsView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var features = FeatureSettings.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("The person above sets what people below them can see and do on \(ShopCrew.jobName). Hide a screen, block assign, or block send-to-inbox. An apprentice does not flip their own set. Default allow. Stays on this phone. Not a backend ABAC. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                seatPicker

                mineReadOnly

                if let me, !below.isEmpty {
                    roleSection(me)
                    personSection(me)
                } else {
                    Text("You cannot change these. The person above assigns them downward.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear { session.ensureShopSeat() }
    }

    private var me: CrewMemberDTO? {
        ShopCrew.member(byID: session.userID)
    }

    private var below: [CrewMemberDTO] {
        me.map { ShopCrew.below($0) } ?? []
    }

    private var seatPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Who I am")
            ForEach(ShopCrew.members) { member in
                Button {
                    session.pickShopSeat(member)
                } label: {
                    HStack {
                        Text("\(member.name)  ·  \(member.role.replacingOccurrences(of: "_", with: " "))")
                            .foregroundStyle(FieldTheme.ink)
                        Spacer()
                        if member.user_id == session.userID {
                            Image(systemName: "checkmark")
                                .foregroundStyle(FieldTheme.orange)
                        }
                    }
                    .padding(12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
                }
            }
        }
    }

    private var mineReadOnly: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("My access")
            let flags = features.flags(for: session.userID)
            ForEach(Self.accessRows, id: \.key) { row in
                readOnlyRow(row.title, value(flags, row.key))
            }
        }
    }

    private func roleSection(_ me: CrewMemberDTO) -> some View {
        let roles = Array(Set(below.map(\.role))).sorted { ShopCrew.rank($0) < ShopCrew.rank($1) }
        return VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Assign by role")
            ForEach(roles, id: \.self) { role in
                VStack(alignment: .leading, spacing: 8) {
                    Text(role.replacingOccurrences(of: "_", with: " "))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FieldTheme.ink)
                    flagToggles(features.byRole[role] ?? FeatureFlags()) { key, on in
                        features.updateRole(role, by: me.user_id) { write(&$0, key, on) }
                    }
                }
            }
        }
    }

    private func personSection(_ me: CrewMemberDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Assign by person")
            ForEach(below) { member in
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(member.name)  ·  \(member.role.replacingOccurrences(of: "_", with: " "))")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FieldTheme.ink)
                    flagToggles(features.flags(for: member)) { key, on in
                        features.updateUser(member.user_id, by: me.user_id) { write(&$0, key, on) }
                    }
                }
            }
        }
    }

    private static let accessRows: [(key: String, title: String)] = [
        ("seeRFI", "See RFI"),
        ("seeProblem", "See Problem"),
        ("material", "See Material"),
        ("prints", "See Prints"),
        ("tasks", "See Tasks"),
        ("calendar", "See Calendar"),
        ("seeInbox", "See Foreman inbox"),
        ("takeoff", "Run takeoff"),
        ("assign", "Assign tasks"),
        ("send", "Send to inbox"),
    ]

    private func flagToggles(_ flags: FeatureFlags, write: @escaping (String, Bool) -> Void) -> some View {
        VStack(spacing: 8) {
            ForEach(Self.accessRows, id: \.key) { row in
                toggle(row.title, value(flags, row.key)) { write(row.key, $0) }
            }
        }
    }

    private func toggle(_ title: String, _ isOn: Bool, set: @escaping (Bool) -> Void) -> some View {
        Toggle(title, isOn: Binding(get: { isOn }, set: set))
            .tint(FieldTheme.orange)
            .padding(12)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func readOnlyRow(_ title: String, _ on: Bool) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(FieldTheme.ink)
            Spacer()
            Text(on ? "On" : "Off")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(on ? Color(red: 0.16, green: 0.45, blue: 0.28) : FieldTheme.muted)
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }

    private func value(_ flags: FeatureFlags, _ key: String) -> Bool {
        switch key {
        case "material": return flags.material
        case "prints": return flags.prints
        case "takeoff": return flags.takeoff
        case "tasks": return flags.tasks
        case "calendar": return flags.calendar
        case "seeRFI": return flags.seeRFI
        case "seeProblem": return flags.seeProblem
        case "seeInbox": return flags.seeInbox
        case "assign": return flags.assign
        case "send": return flags.send
        default: return true
        }
    }

    private func write(_ flags: inout FeatureFlags, _ key: String, _ on: Bool) {
        switch key {
        case "material": flags.material = on
        case "prints": flags.prints = on
        case "takeoff": flags.takeoff = on
        case "tasks": flags.tasks = on
        case "calendar": flags.calendar = on
        case "seeRFI": flags.seeRFI = on
        case "seeProblem": flags.seeProblem = on
        case "seeInbox": flags.seeInbox = on
        case "assign": flags.assign = on
        case "send": flags.send = on
        default: break
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
