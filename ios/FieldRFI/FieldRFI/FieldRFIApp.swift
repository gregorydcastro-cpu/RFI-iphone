import SwiftUI

@main
struct FieldRFIApp: App {
    @StateObject private var session = FieldSession()

    var body: some Scene {
        WindowGroup {
            TabView {
                NavigationStack {
                    NewRFIView()
                }
                .tabItem {
                    Label(session.isApprentice ? "Material" : "New RFI", systemImage: "plus.rectangle.on.folder")
                }
                NavigationStack {
                    RFIGraphView()
                }
                .tabItem {
                    Label("RFI Graph", systemImage: "list.bullet.rectangle")
                }
            }
            .environmentObject(session)
            .tint(FieldTheme.orange)
        }
    }
}
