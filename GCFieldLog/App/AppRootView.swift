import SwiftData
import SwiftUI
import UIKit

struct AppRootView: View {
    @Environment(SessionController.self) private var session
    @Query(sort: \CrewMember.name) private var crew: [CrewMember]

    var body: some View {
        Group {
            if UIDevice.current.userInterfaceIdiom == .pad {
                PadRootView()
            } else {
                PhoneRootView()
            }
        }
        .sheet(isPresented: pinPadBinding) {
            PINPadView(crew: crew.filter { $0.id != session.signedInID }) { member in
                session.startPINSession(member: member)
            }
        }
        .overlay(alignment: .top) {
            if let toast = session.toast {
                ToastBanner(text: toast) {
                    session.toast = nil
                }
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: session.toast)
        .onChange(of: session.toast) { _, new in
            guard new != nil else { return }
            Task {
                try? await Task.sleep(for: .seconds(3.2))
                if session.toast == new {
                    session.toast = nil
                }
            }
        }
    }

    private var pinPadBinding: Binding<Bool> {
        Binding(
            get: { session.showPINPad },
            set: { session.showPINPad = $0 }
        )
    }
}

struct ToastBanner: View {
    let text: String
    var onClose: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "bolt.fill")
                .foregroundStyle(GCTheme.brand)
            Text(text)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.bold))
                    .padding(8)
            }
            .accessibilityLabel("Dismiss")
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(GCTheme.brand.opacity(0.35))
        )
        .padding(.horizontal)
        .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
    }
}

#Preview("GC Field Log") {
    let container = DemoSeed.previewContainer()
    AppRootView()
        .environment(SessionController())
        .environment(BumpService())
        .modelContainer(container)
}
