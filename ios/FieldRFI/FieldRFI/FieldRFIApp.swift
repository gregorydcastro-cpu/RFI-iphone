import SwiftUI

@main
struct FieldRFIApp: App {
    @StateObject private var session = FieldSession()
    @ObservedObject private var meetings = MeetingBoard.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            TabView {
                NavigationStack {
                    NewRFIView()
                }
                .tabItem {
                    Label("RFI", systemImage: "plus.rectangle.on.folder")
                }
                if session.canCaptureField || session.assignment == nil {
                    NavigationStack {
                        FieldProblemView()
                    }
                    .tabItem {
                        Label("Problem", systemImage: "exclamationmark.triangle")
                    }
                }
                NavigationStack {
                    MaterialAskView()
                }
                .tabItem {
                    Label("Material", systemImage: "shippingbox")
                }
                if session.canCaptureField || session.assignment == nil {
                    NavigationStack {
                        PrintPhotoView()
                    }
                    .tabItem {
                        Label("Prints", systemImage: "doc.richtext")
                    }
                }
                NavigationStack {
                    TaskAssignView()
                }
                .tabItem {
                    Label("Tasks", systemImage: "checkmark.circle")
                }
                NavigationStack {
                    MeetingCalendarView()
                }
                .tabItem {
                    Label("Meet", systemImage: "calendar")
                }
                NavigationStack {
                    ForemanInboxView()
                }
                .tabItem {
                    Label("Foreman", systemImage: "person.2")
                }
            }
            .environmentObject(session)
            .safeAreaInset(edge: .top, spacing: 0) {
                MeetingSoonBanner()
            }
            .tint(FieldTheme.orange)
            .onAppear {
                session.ensureLocalSeat()
                meetings.tick()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    meetings.tick()
                }
            }
            .onReceive(Timer.publish(every: 30, on: .main, in: .common).autoconnect()) { _ in
                meetings.tick()
            }
        }
    }
}
