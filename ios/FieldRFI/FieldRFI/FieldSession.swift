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
        assignment?.capabilities["view_rfi_graph"] == true
    }

    var banner: String {
        guard let assignment else { return "Sign in to a seat on this job." }
        let area = assignment.area_name ?? "the job"
        let boss = assignment.boss_name.map { "Reports to \($0)" } ?? "General Foreman"
        return "\(assignment.name)  ·  \(assignment.role.replacingOccurrences(of: "_", with: " "))  ·  \(area). \(boss)."
    }

    func load(client: APIClient, projectID: String) async {
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
