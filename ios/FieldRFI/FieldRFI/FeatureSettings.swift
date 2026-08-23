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
    @Published private(set) var directLines: Set<String> = []
    /// apprentice user id → journeyman user id
    @Published private(set) var pairs: [String: String] = [:]

    private let key = "gcfieldlog.features.v2"

    init() {
        load()
        ensureDefaultPairs()
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

    func hasDirectLine(_ userID: String?) -> Bool {
        guard let userID else { return false }
        return directLines.contains(userID)
    }

    func canGrantDirectLine(from actorID: String?, to targetID: String) -> Bool {
        guard let actor = ShopCrew.member(byID: actorID),
              let target = ShopCrew.member(byID: targetID)
        else { return false }
        return actor.role == "general_foreman"
            && target.role == "apprentice"
            && ShopCrew.isBelow(target, of: actor)
    }

    func setDirectLine(_ targetID: String, on: Bool, by actorID: String?) {
        guard canGrantDirectLine(from: actorID, to: targetID) else { return }
        if on {
            directLines.insert(targetID)
        } else {
            directLines.remove(targetID)
        }
        save()
    }

    func sendTargets(for userID: String?) -> [CrewMemberDTO] {
        guard let me = ShopCrew.member(byID: userID) else { return [] }
        var rows: [CrewMemberDTO] = []
        if let boss = ShopCrew.oneStepUp(from: me) {
            rows.append(boss)
        }
        if me.role == "apprentice",
           hasDirectLine(me.user_id),
           let gf = ShopCrew.members.first(where: { $0.role == "general_foreman" }),
           !rows.contains(where: { $0.user_id == gf.user_id }) {
            rows.append(gf)
        }
        return rows
    }

    func pairedApprentice(ofJourneyman journeymanID: String?) -> CrewMemberDTO? {
        guard let journeymanID,
              let apprenticeID = pairs.first(where: { $0.value == journeymanID })?.key
        else { return nil }
        return ShopCrew.member(byID: apprenticeID)
    }

    func pairedJourneyman(ofApprentice apprenticeID: String?) -> CrewMemberDTO? {
        guard let apprenticeID, let journeymanID = pairs[apprenticeID] else { return nil }
        return ShopCrew.member(byID: journeymanID)
    }

    func pickupAssignee(for userID: String?) -> CrewMemberDTO? {
        guard let me = ShopCrew.member(byID: userID) else {
            return ShopCrew.members.first(where: { $0.role == "apprentice" })
        }
        if me.role == "journeyman", let apprentice = pairedApprentice(ofJourneyman: me.user_id) {
            return apprentice
        }
        if me.role == "apprentice" {
            return me
        }
        if let journeyman = ShopCrew.members.first(where: { $0.role == "journeyman" }),
           let apprentice = pairedApprentice(ofJourneyman: journeyman.user_id) {
            return apprentice
        }
        return ShopCrew.members.first(where: { $0.role == "apprentice" })
    }

    func canSetPair(from actorID: String?) -> Bool {
        guard let actor = ShopCrew.member(byID: actorID) else { return false }
        return ["general_foreman", "area_foreman", "foreman"].contains(actor.role)
    }

    func setPair(apprenticeID: String, journeymanID: String, by actorID: String?) {
        guard canSetPair(from: actorID),
              let apprentice = ShopCrew.member(byID: apprenticeID),
              let journeyman = ShopCrew.member(byID: journeymanID),
              apprentice.role == "apprentice",
              journeyman.role == "journeyman"
        else { return }
        pairs = pairs.filter { $0.key != apprenticeID && $0.value != journeymanID }
        pairs[apprenticeID] = journeymanID
        save()
    }

    func ensureDefaultPairs() {
        guard pairs.isEmpty else { return }
        for apprentice in ShopCrew.members where apprentice.role == "apprentice" {
            if let boss = ShopCrew.oneStepUp(from: apprentice), boss.role == "journeyman" {
                pairs[apprentice.user_id] = boss.user_id
            }
        }
        if !pairs.isEmpty {
            save()
        }
    }

    func assignTargets(for userID: String?) -> [CrewMemberDTO] {
        guard let me = ShopCrew.member(byID: userID) else { return [] }
        var rows = ShopCrew.directReports(of: me)
        if me.role == "journeyman" {
            rows.removeAll { $0.role == "apprentice" }
            if let apprentice = pairedApprentice(ofJourneyman: me.user_id) {
                rows.append(apprentice)
            }
        }
        if me.role == "general_foreman" {
            for apprentice in ShopCrew.members where apprentice.role == "apprentice" && hasDirectLine(apprentice.user_id) {
                if !rows.contains(where: { $0.user_id == apprentice.user_id }) {
                    rows.append(apprentice)
                }
            }
        }
        return rows
    }

    func mayAssign(from fromID: String?, to toID: String) -> Bool {
        assignTargets(for: fromID).contains(where: { $0.user_id == toID })
    }

    func maySend(from fromID: String?, to toID: String) -> Bool {
        sendTargets(for: fromID).contains(where: { $0.user_id == toID })
    }

    func canAssign(from actorID: String?, toUser targetID: String) -> Bool {
        mayAssign(from: actorID, to: targetID)
    }

    func canAssign(from actorID: String?, toRole role: String) -> Bool {
        assignTargets(for: actorID).contains(where: { $0.role == role })
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
        directLines = Set(box.directLines ?? [])
        pairs = box.pairs ?? [:]
    }

    private func save() {
        let box = Box(byUser: byUser, byRole: byRole, directLines: Array(directLines), pairs: pairs)
        if let data = try? JSONEncoder().encode(box) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }

    private struct Box: Codable {
        var byUser: [String: FeatureFlags]
        var byRole: [String: FeatureFlags]
        var directLines: [String]?
        var pairs: [String: String]?
    }
}

struct FeatureSettingsView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var features = FeatureSettings.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Company shop iPhone on \(ShopCrew.jobName). Pick who you are. The person above sets what their direct reports can see and do. Default is one step. A GF can grant a named apprentice a direct line. No personal Apple ID required. Not MDM. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)

                ShopSeatPicker()

                mineReadOnly

                pairingSection

                if let me, me.role == "general_foreman" {
                    directLineSection(me)
                } else if features.hasDirectLine(session.userID) {
                    Text("Direct line to the GF is on. You cannot open or close it.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                }

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
        features.assignTargets(for: session.userID)
    }

    private var pairingSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Journeyman / apprentice pair")
            Text("Material pickup and similar assigns go to this pair on \(ShopCrew.jobName). Existing mock names only.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            ForEach(ShopCrew.members.filter { $0.role == "journeyman" }) { journeyman in
                VStack(alignment: .leading, spacing: 8) {
                    Text(journeyman.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FieldTheme.ink)
                    if features.canSetPair(from: session.userID) {
                        ForEach(ShopCrew.members.filter { $0.role == "apprentice" }) { apprentice in
                            Button {
                                features.setPair(
                                    apprenticeID: apprentice.user_id,
                                    journeymanID: journeyman.user_id,
                                    by: session.userID
                                )
                            } label: {
                                HStack {
                                    Text(apprentice.name)
                                        .foregroundStyle(FieldTheme.ink)
                                    Spacer()
                                    if features.pairedApprentice(ofJourneyman: journeyman.user_id)?.user_id == apprentice.user_id {
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
                    } else if let apprentice = features.pairedApprentice(ofJourneyman: journeyman.user_id) {
                        Text("Paired with \(apprentice.name). You cannot change this.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    } else if let me, me.role == "apprentice",
                              let journeyman = features.pairedJourneyman(ofApprentice: me.user_id) {
                        Text("Paired with \(journeyman.name). You cannot change this.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                }
            }
        }
    }

    private func directLineSection(_ me: CrewMemberDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Direct line")
            Text("Default is one step up. Grant a named apprentice a skip to you for assistant or material check. They cannot open it.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            ForEach(ShopCrew.members.filter { $0.role == "apprentice" }) { member in
                Toggle("\(member.name)  ·  direct line", isOn: Binding(
                    get: { features.hasDirectLine(member.user_id) },
                    set: { features.setDirectLine(member.user_id, on: $0, by: me.user_id) }
                ))
                .tint(FieldTheme.orange)
                .padding(12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
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

/// Extra send target only when the GF granted a direct line. Default is one step up.
struct SendTargetPicker: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var features = FeatureSettings.shared

    var body: some View {
        let options = features.sendTargets(for: session.userID)
        if options.count > 1 {
            VStack(alignment: .leading, spacing: 8) {
                Text("SEND TO")
                    .font(.caption.weight(.semibold))
                    .tracking(0.8)
                    .foregroundStyle(FieldTheme.muted)
                ForEach(options) { member in
                    Button {
                        session.sendOverrideID = member.user_id
                    } label: {
                        HStack {
                            Text("\(member.name)  ·  \(member.role.replacingOccurrences(of: "_", with: " "))")
                                .foregroundStyle(FieldTheme.ink)
                            Spacer()
                            if session.sendTarget()?.id == member.user_id {
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
    }
}
