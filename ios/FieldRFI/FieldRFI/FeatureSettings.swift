import Foundation
import SwiftUI

/// On-device product features. Default on. Assigned downward. No HTTP.
struct FeatureFlags: Codable, Equatable {
    var material: Bool = true
    var prints: Bool = true
    var takeoff: Bool = true
    var tasks: Bool = true
    var calendar: Bool = true

    func mergingOff(_ other: FeatureFlags) -> FeatureFlags {
        FeatureFlags(
            material: material && other.material,
            prints: prints && other.prints,
            takeoff: takeoff && other.takeoff,
            tasks: tasks && other.tasks,
            calendar: calendar && other.calendar
        )
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
                Text("The person above sets features for people below them on \(ShopCrew.jobName). An apprentice does not flip their own set. Default on. Stays on this phone. Not Procore.")
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
            sectionLabel("My features")
            let flags = features.flags(for: session.userID)
            readOnlyRow("Material", flags.material)
            readOnlyRow("Prints", flags.prints)
            readOnlyRow("Takeoff", flags.takeoff)
            readOnlyRow("Tasks", flags.tasks)
            readOnlyRow("Calendar", flags.calendar)
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

    private func flagToggles(_ flags: FeatureFlags, write: @escaping (String, Bool) -> Void) -> some View {
        VStack(spacing: 8) {
            toggle("Material", flags.material) { write("material", $0) }
            toggle("Prints", flags.prints) { write("prints", $0) }
            toggle("Takeoff", flags.takeoff) { write("takeoff", $0) }
            toggle("Tasks", flags.tasks) { write("tasks", $0) }
            toggle("Calendar", flags.calendar) { write("calendar", $0) }
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

    private func write(_ flags: inout FeatureFlags, _ key: String, _ on: Bool) {
        switch key {
        case "material": flags.material = on
        case "prints": flags.prints = on
        case "takeoff": flags.takeoff = on
        case "tasks": flags.tasks = on
        case "calendar": flags.calendar = on
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
