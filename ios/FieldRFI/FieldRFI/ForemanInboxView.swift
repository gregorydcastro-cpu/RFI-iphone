import SwiftUI
import UIKit

struct ForemanInboxView: View {
    @EnvironmentObject private var session: FieldSession
    @ObservedObject private var outbox = FieldOutbox.shared
    @ObservedObject private var board = MaterialBoard.shared
    @ObservedObject private var tasks = TaskBoard.shared

    var body: some View {
        List {
            Section("Seat") {
                Text(session.banner)
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.ink)
                if let target = session.sendTarget() {
                    Text("Sends one step up to \(target.name). No skip-level. Enters Procore later. No work-stopped from this app.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.muted)
                }
            }

            Section("Incoming") {
                let incoming = incomingPackets
                if incoming.isEmpty {
                    Text("Nothing sent to this seat yet.")
                        .foregroundStyle(FieldTheme.muted)
                }
                ForEach(incoming) { row in
                    packetLink(row)
                }
            }

            Section("Sent from this phone") {
                let outgoing = outgoingPackets
                if outgoing.isEmpty {
                    Text("No packets sent.")
                        .foregroundStyle(FieldTheme.muted)
                }
                ForEach(outgoing) { row in
                    packetLink(row)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color(red: 0.93, green: 0.92, blue: 0.88))
        .navigationTitle("Foreman")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FieldTheme.steel, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            session.ensureLocalSeat()
            outbox.load()
        }
        .task {
            session.ensureLocalSeat()
            outbox.load()
            guard APIClient.hasServerHost else { return }
            let client = APIClient()
            if let project = try? await client.projects(),
               let first = project.first {
                await session.load(client: client, projectID: first.id)
            }
        }
    }

    private var incomingPackets: [FieldPacket] {
        if session.assignment == nil {
            return outbox.sentOnDevice()
        }
        return session.userID.map { outbox.incoming(for: $0) } ?? []
    }

    private var outgoingPackets: [FieldPacket] {
        session.userID.map { outbox.outgoing(for: $0) } ?? outbox.packets
    }

    @ViewBuilder
    private func packetLink(_ row: FieldPacket) -> some View {
        if row.kind == .printPhoto {
            NavigationLink {
                PrintMarkupView(packet: row)
            } label: {
                packetRow(row)
            }
        } else {
            packetRow(row)
        }
    }

    private func packetRow(_ row: FieldPacket) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(row.kind.title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(FieldTheme.orange)
                Spacer()
                Text(materialStatus(row))
                    .font(.caption2)
                    .foregroundStyle(FieldTheme.muted)
            }
            Text(row.note.isEmpty ? row.projectName : row.note)
                .font(.subheadline)
                .foregroundStyle(FieldTheme.ink)
            HStack {
                if let sheet = row.sheetNumber, let rev = row.revision {
                    Text("\(sheet) Rev \(rev)")
                }
                if let label = row.pinLabel {
                    Text("· \(label)")
                }
                if !row.materialLines.isEmpty {
                    Text("· \(row.materialLines.count) line(s)")
                }
                if row.kind == .printPhoto || (row.kind == .task && row.photoCount > 0) {
                    Text("· \(row.attachedPrints) print(s) · \(row.photoCount) photo(s)")
                }
            }
            .font(.caption)
            .foregroundStyle(FieldTheme.muted)
            ForEach(row.materialLines, id: \.self) { line in
                Text("\(line.qty.formatted()) \(line.uom)  \(line.description)")
                    .font(.caption)
                    .foregroundStyle(FieldTheme.ink)
            }
            Text("\(row.createdByName) → \(row.sentToName)")
                .font(.caption2)
                .foregroundStyle(FieldTheme.muted)
            if row.kind == .task, let task = tasks.task(id: row.id), let image = tasks.proofImage(for: task) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, minHeight: 80, maxHeight: 120)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(.vertical, 4)
    }

    private func materialStatus(_ row: FieldPacket) -> String {
        if row.kind == .materialAsk, let status = board.status(forListID: row.id) {
            return status.label
        }
        if row.kind == .task, let task = tasks.task(id: row.id) {
            return task.status.label
        }
        return row.isSent ? "sent" : "draft"
    }
}
