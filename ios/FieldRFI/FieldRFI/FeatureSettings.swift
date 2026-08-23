import Foundation
import SwiftUI

/// On-device product features. Default on. Persist on this phone. No HTTP.
struct FeatureFlags: Codable, Equatable {
    var material: Bool = true
    var prints: Bool = true
    var takeoff: Bool = true
    var tasks: Bool = true
    var calendar: Bool = true
}

@MainActor
final class FeatureSettings: ObservableObject {
    static let shared = FeatureSettings()

    @Published private(set) var phone = FeatureFlags()
    @Published private(set) var byUser: [String: FeatureFlags] = [:]

    private let key = "gcfieldlog.features.v1"

    init() {
        load()
    }

    func flags(for userID: String?) -> FeatureFlags {
        guard let userID, !userID.isEmpty, userID != "local-field" else { return phone }
        return byUser[userID] ?? FeatureFlags()
    }

    func set(_ flags: FeatureFlags, for userID: String?) {
        if let userID, !userID.isEmpty, userID != "local-field" {
            byUser[userID] = flags
        } else {
            phone = flags
        }
        save()
    }

    func update(_ userID: String?, _ mutate: (inout FeatureFlags) -> Void) {
        var next = flags(for: userID)
        mutate(&next)
        set(next, for: userID)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let box = try? JSONDecoder().decode(Box.self, from: data)
        else { return }
        phone = box.phone
        byUser = box.byUser
    }

    private func save() {
        let box = Box(phone: phone, byUser: byUser)
        if let data = try? JSONEncoder().encode(box) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }

    private struct Box: Codable {
        var phone: FeatureFlags
        var byUser: [String: FeatureFlags]
    }
}

struct FeatureSettingsView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var features = FeatureSettings.shared

    var body: some View {
        let flags = features.flags(for: session.userID)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Uncheck features you do not want on this phone. Default on. Stays on this device. Not Procore.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.ink)
                toggle("Material", isOn: flags.material) { $0.material = $1 }
                toggle("Prints", isOn: flags.prints) { $0.prints = $1 }
                toggle("Takeoff", isOn: flags.takeoff) { $0.takeoff = $1 }
                toggle("Tasks", isOn: flags.tasks) { $0.tasks = $1 }
                toggle("Calendar", isOn: flags.calendar) { $0.calendar = $1 }
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

    private func toggle(
        _ title: String,
        isOn: Bool,
        write: @escaping (inout FeatureFlags, Bool) -> Void
    ) -> some View {
        Toggle(title, isOn: Binding(
            get: { isOn },
            set: { next in
                features.update(session.userID) { write(&$0, next) }
            }
        ))
        .tint(FieldTheme.orange)
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldTheme.rule, lineWidth: 1))
    }
}
