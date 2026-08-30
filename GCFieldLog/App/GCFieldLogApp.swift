import SwiftData
import SwiftUI

@main
struct GCFieldLogApp: App {
    let container: ModelContainer
    @State private var session = SessionController()
    @State private var bump = BumpService()

    init() {
        let schema = SchemaModels.schema
        let config = ModelConfiguration("GCFieldLog", schema: schema)
        do {
            container = try ModelContainer(for: schema, configurations: config)
        } catch {
            // Demo-only fallback: in-memory store if the on-disk store cannot open.
            container = try! ModelContainer(
                for: schema,
                configurations: ModelConfiguration(isStoredInMemoryOnly: true)
            )
        }
        DemoSeed.ensure(in: container.mainContext)
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environment(session)
                .environment(bump)
                .tint(GCTheme.brand)
        }
        .modelContainer(container)
    }
}
