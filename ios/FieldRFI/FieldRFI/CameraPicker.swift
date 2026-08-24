import SwiftUI
import UIKit

/// Job photo from the shop camera, or photos already on this phone.
/// Personal photo library is not the only path.
struct CameraPicker: View {
    var onCapture: (PickedPhoto) -> Void

    var body: some View {
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            CameraPickerController(onCapture: onCapture)
                .ignoresSafeArea()
        } else {
            InAppJobPhotoPicker(onCapture: onCapture)
        }
    }
}

struct CameraPickerController: UIViewControllerRepresentable {
    var onCapture: (PickedPhoto) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture, dismiss: dismiss)
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let onCapture: (PickedPhoto) -> Void
        let dismiss: DismissAction

        init(onCapture: @escaping (PickedPhoto) -> Void, dismiss: DismissAction) {
            self.onCapture = onCapture
            self.dismiss = dismiss
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            dismiss()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage,
               let jpeg = image.jpegData(compressionQuality: 0.72) {
                let name = "field-\(UUID().uuidString.prefix(8)).jpg"
                onCapture(PickedPhoto(filename: name, jpegData: jpeg))
            }
            dismiss()
        }
    }
}

/// Photos already saved in this app. No iCloud. No personal library required.
struct InAppJobPhotoPicker: View {
    var onCapture: (PickedPhoto) -> Void
    @ObservedObject private var store = FieldAttachmentStore.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Photos stay in this app. Company iPhone is the default. A personal library still works if this phone has one.")
                        .font(.subheadline)
                        .foregroundStyle(FieldTheme.ink)
                    let jobs = store.index.filter { $0.kind == .jpeg }
                    if jobs.isEmpty {
                        Text("No job photos in the app yet. Use the camera, or the library on a personal phone.")
                            .font(.footnote)
                            .foregroundStyle(FieldTheme.muted)
                    }
                    ForEach(jobs) { att in
                        if let image = store.previewImage(for: att),
                           let data = store.data(for: att) {
                            Button {
                                onCapture(PickedPhoto(filename: att.filename, jpegData: data))
                                dismiss()
                            } label: {
                                HStack {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 64, height: 64)
                                        .clipped()
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                    Text(att.filename)
                                        .foregroundStyle(FieldTheme.ink)
                                    Spacer()
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Color(red: 0.93, green: 0.92, blue: 0.88))
            .navigationTitle("On this phone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
