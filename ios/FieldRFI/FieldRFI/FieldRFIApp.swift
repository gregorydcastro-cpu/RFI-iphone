import SwiftUI

@main
struct FieldRFIApp: App {
    @StateObject private var session = FieldSession()
    @ObservedObject private var meetings = MeetingBoard.shared
    @ObservedObject private var tasks = TaskBoard.shared
    @ObservedObject private var features = FeatureSettings.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            let flags = features.flags(for: session.userID)
            TabView {
                if flags.seeRFI {
                    NavigationStack {
                        NewRFIView()
                    }
                    .tabItem {
                        Label("RFI", systemImage: "plus.rectangle.on.folder")
                    }
                }
                if flags.seeProblem && (session.canCaptureField || session.assignment == nil) {
                    NavigationStack {
                        FieldProblemView()
                    }
                    .tabItem {
                        Label("Problem", systemImage: "exclamationmark.triangle")
                    }
                }
                if flags.material {
                    NavigationStack {
                        MaterialAskView()
                    }
                    .tabItem {
                        Label("Material", systemImage: "shippingbox")
                    }
                }
                if flags.prints && (session.canCaptureField || session.assignment == nil) {
                    NavigationStack {
                        PrintPhotoView()
                    }
                    .tabItem {
                        Label("Prints", systemImage: "doc.richtext")
                    }
                }
                if flags.tasks {
                    NavigationStack {
                        TaskAssignView()
                    }
                    .tabItem {
                        Label("Tasks", systemImage: "checkmark.circle")
                    }
                }
                if flags.calendar {
                    NavigationStack {
                        MeetingCalendarView()
                    }
                    .tabItem {
                        Label("Meet", systemImage: "calendar")
                    }
                }
                if flags.seeInbox {
                    NavigationStack {
                        ForemanInboxView()
                    }
                    .tabItem {
                        Label("Foreman", systemImage: "person.2")
                    }
                }
                NavigationStack {
                    FeatureSettingsView()
                }
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
            }
            .environmentObject(session)
            .safeAreaInset(edge: .top, spacing: 0) {
                if flags.calendar {
                    MeetingSoonBanner()
                }
            }
            .tint(FieldTheme.orange)
            .onAppear {
                session.ensureLocalSeat()
                meetings.tick()
                tasks.tick()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    meetings.tick()
                    tasks.tick()
                }
            }
            .onReceive(Timer.publish(every: 30, on: .main, in: .common).autoconnect()) { _ in
                meetings.tick()
                tasks.tick()
            }
        }
    }
}
