import PhotosUI
import SwiftUI
import UIKit

struct PhotoStripView: View {
    @Binding var photos: [PickedPhoto]
    var onAdd: (PickedPhoto) -> Void
    var onRemove: (PickedPhoto) -> Void

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var showOnPhone = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Photos")
            Text("Camera or photos already on this phone. Personal library is optional. No iCloud required.")
                .font(.caption)
                .foregroundStyle(FieldTheme.muted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    Button {
                        showCamera = true
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: "camera")
                                .font(.title2.weight(.semibold))
                            Text("Camera")
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(FieldTheme.orange)
                        .frame(width: 84, height: 84)
                        .background(FieldTheme.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(FieldTheme.orange.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4]))
                        )
                    }
                    .sheet(isPresented: $showCamera) {
                        CameraPicker(onCapture: onAdd)
                    }

                    Button {
                        showOnPhone = true
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: "iphone")
                                .font(.title2.weight(.semibold))
                            Text("On phone")
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(FieldTheme.orange)
                        .frame(width: 84, height: 84)
                        .background(FieldTheme.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(FieldTheme.orange.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4]))
                        )
                    }
                    .sheet(isPresented: $showOnPhone) {
                        InAppJobPhotoPicker(onCapture: onAdd)
                    }

                    PhotosPicker(selection: $pickerItems, maxSelectionCount: 6, matching: .images) {
                        VStack(spacing: 6) {
                            Image(systemName: "photo.on.rectangle")
                                .font(.title2.weight(.semibold))
                            Text("Optional")
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(FieldTheme.orange)
                        .frame(width: 84, height: 84)
                        .background(FieldTheme.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(FieldTheme.orange.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4]))
                        )
                    }
                    .onChange(of: pickerItems) { _, items in
                        Task { await load(items) }
                    }

                    ForEach(photos) { photo in
                        ZStack(alignment: .topTrailing) {
                            if let image = UIImage(data: photo.jpegData) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 84, height: 84)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            Button {
                                onRemove(photo)
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.white, .black.opacity(0.65))
                            }
                            .offset(x: 4, y: -4)
                        }
                    }
                }
            }
        }
    }

    private func load(_ items: [PhotosPickerItem]) async {
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = image.jpegData(compressionQuality: 0.72) {
                let name = "field-\(UUID().uuidString.prefix(8)).jpg"
                onAdd(PickedPhoto(filename: name, jpegData: jpeg))
            }
        }
        pickerItems = []
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(FieldTheme.muted)
    }
}
