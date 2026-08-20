import Foundation
import SwiftUI

@MainActor
final class PESubmitViewModel: ObservableObject {
    let rfiID: String
    @Published var baseURLString = APIClient.defaultBaseURL.absoluteString
    @Published var rfi: RFIDTO?
    @Published var roster: AssigneeRosterDTO?
    @Published var priority = "standard"
    @Published var workStopped = false
    @Published var requireInternalReview = true
    @Published var selectedUserID: String?
    @Published var selectedCompanyID: String?
    @Published var comment = ""
    @Published var isLoading = false
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var submitResult: PESubmitResultDTO?

    init(rfiID: String) {
        self.rfiID = rfiID
    }

    private var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    var canApprove: Bool {
        rfi?.status == "draft" && !isWorking && submitResult == nil
    }

    var canSubmit: Bool {
        guard let rfi, submitResult == nil, !isWorking else { return false }
        let allowed = ["draft", "internal_review", "needs_clarification"]
        guard allowed.contains(rfi.status) else { return false }
        if requireInternalReview && rfi.status == "draft" {
            return false
        }
        return selectedUserID != nil || selectedCompanyID != nil
    }

    var selectedUser: AssigneeUserDTO? {
        roster?.users.first(where: { $0.id == selectedUserID })
    }

    var selectedCompany: AssigneeCompanyDTO? {
        roster?.companies.first(where: { $0.id == selectedCompanyID })
    }

    func syncPriority(fromPriority value: String) {
        priority = value
        workStopped = value == "work_stopped"
    }

    func syncWorkStopped(_ stopped: Bool) {
        workStopped = stopped
        if stopped {
            priority = "work_stopped"
        } else if priority == "work_stopped" {
            priority = "standard"
        }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let detail = client.rfi(id: rfiID)
            async let people = client.peAssignees()
            let loaded = try await detail
            rfi = loaded
            roster = try await people
            syncPriority(fromPriority: loaded.priority)
            if selectedUserID == nil {
                selectedUserID = loaded.assigned_to_user_id
                    ?? roster?.users.first(where: { $0.role == "ae" })?.id
                    ?? roster?.users.first?.id
            }
            if selectedCompanyID == nil {
                selectedCompanyID = loaded.assigned_to_company_id
                    ?? selectedUser?.company_id
                    ?? roster?.companies.first?.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func approveReview() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            _ = try await client.peApproveInternalReview(rfiID: rfiID)
            rfi = try await client.rfi(id: rfiID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func submit() async {
        guard canSubmit else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let result = try await client.peSubmit(
                rfiID: rfiID,
                body: PESubmitBody(
                    priority: priority,
                    work_stopped: workStopped,
                    require_internal_review: requireInternalReview,
                    assigned_to_user_id: selectedUserID,
                    assigned_to_company_id: selectedCompanyID,
                    assignee: selectedUser?.name,
                    comment: comment.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            submitResult = result
            rfi = try await client.rfi(id: rfiID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
