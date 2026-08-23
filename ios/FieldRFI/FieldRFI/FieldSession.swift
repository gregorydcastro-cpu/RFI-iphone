import Foundation
import SwiftUI

@MainActor
final class FieldSession: ObservableObject {
    @Published var userID: String?
    @Published var assignment: AssignmentDTO?
    @Published var crew: [CrewMemberDTO] = []

    var role: String { assignment?.role ?? "" }

    var isApprentice: Bool { role == "apprentice" }

    var canDraftRFI: Bool {
        assignment?.capabilities["create_rfi_draft"] == true
    }

    var canSubmitRFI: Bool {
        assignment?.capabilities["submit_rfi"] == true
    }

    var canWorkStop: Bool {
        assignment?.capabilities["set_priority"] == true
    }

    var canHandleMaterial: Bool {
        assignment?.capabilities["handle_material"] == true
    }

    var canViewRFIGraph: Bool {
        ["foreman", "area_foreman", "general_foreman"].contains(role)
            || assignment?.capabilities["view_rfi_graph"] == true
    }

    var canCaptureField: Bool {
        !isApprentice && (
            canDraftRFI
                || assignment == nil
                || ["journeyman", "foreman", "area_foreman", "general_foreman"].contains(role)
        )
    }

    func sendTarget() -> (id: String, name: String)? {
        if let id = assignment?.reports_to_user_id, let name = assignment?.boss_name, !id.isEmpty {
            return (id, name)
        }
        if ["foreman", "area_foreman", "general_foreman"].contains(role),
           let me = assignment {
            return (me.user_id, me.name)
        }
        return ("local-foreman", "Foreman")
    }

    func ensureLocalSeat() {
        if userID == nil {
            userID = "local-field"
        }
    }

    func ensureShopSeat() {
        if crew.isEmpty {
            crew = ShopCrew.members
        }
        if userID == nil || userID == "local-field" {
            pickShopSeat(ShopCrew.members.first(where: { $0.role == "journeyman" }) ?? ShopCrew.members[0])
        }
    }

    func pickShopSeat(_ member: CrewMemberDTO) {
        if crew.isEmpty {
            crew = ShopCrew.members
        }
        userID = member.user_id
        assignment = AssignmentDTO(
            ok: true,
            user_id: member.user_id,
            name: member.name,
            role: member.role,
            project_id: ShopCrew.jobID,
            area_id: nil,
            area_name: ShopCrew.jobName,
            reports_to_user_id: member.reports_to_user_id,
            boss_name: member.boss_name,
            boss_role: nil,
            capabilities: [:],
            chain: []
        )
    }

    var banner: String {
        guard let assignment else {
            return "On this phone. Send-to-foreman is local. No API host required."
        }
        let area = assignment.area_name ?? "the job"
        let boss = assignment.boss_name.map { "Reports to \($0)" } ?? "General Foreman"
        return "\(assignment.name)  ·  \(assignment.role.replacingOccurrences(of: "_", with: " "))  ·  \(area). \(boss)."
    }

    func load(client: APIClient, projectID: String) async {
        guard APIClient.hasServerHost else {
            ensureLocalSeat()
            return
        }
        do {
            let loaded = try await client.crew(projectID: projectID)
            crew = loaded.members
            if userID == nil || !crew.contains(where: { $0.user_id == userID }) {
                userID = crew.first(where: { $0.role == "journeyman" })?.user_id
                    ?? crew.first?.user_id
            }
            if let userID {
                assignment = try await client.assignment(projectID: projectID, userID: userID)
            }
        } catch {
            assignment = nil
        }
    }

    func select(userID: String, client: APIClient, projectID: String) async {
        self.userID = userID
        guard APIClient.hasServerHost else { return }
        assignment = try? await client.assignment(projectID: projectID, userID: userID)
    }

    func fieldHeaders() -> [String: String] {
        guard let userID, !role.isEmpty else { return [:] }
        return ["X-User-Id": userID, "X-Field-Role": role]
    }

    func actorDTO() -> ActorDTO? {
        guard let userID, canDraftRFI else { return nil }
        return ActorDTO(
            user_id: userID,
            role: role,
            action: "create_rfi_draft",
            actor_type: "grokbot",
            on_behalf_of_role: role,
            project_id: assignment?.project_id,
            area_id: assignment?.area_id
        )
    }
}
