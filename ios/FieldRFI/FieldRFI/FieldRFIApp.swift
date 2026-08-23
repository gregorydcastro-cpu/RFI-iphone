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
            .tint(FieldTheme.orange)
            .onAppear { session.ensureLocalSeat() }
        }
    }
}
