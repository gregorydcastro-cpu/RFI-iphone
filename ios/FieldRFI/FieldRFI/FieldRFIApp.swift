import SwiftUI

@main
struct FieldRFIApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                NavigationStack {
                    NewRFIView()
                }
                .tabItem {
                    Label("New RFI", systemImage: "plus.rectangle.on.folder")
                }
                NavigationStack {
                    RFIGraphView()
                }
                .tabItem {
                    Label("RFI Graph", systemImage: "list.bullet.rectangle")
                }
            }
            .tint(FieldTheme.orange)
        }
    }
}
