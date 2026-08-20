import Foundation

struct ProjectDTO: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let organization_name: String
    let address: String?
    let architect: String?
    let project_number: String?
}

struct SheetRevisionDTO: Codable, Identifiable, Hashable {
    let id: String
    let sheet_id: String
    let sheet_number: String
    let revision: String
    let discipline: String
    let title: String
    let drawing_url: String
    let file_url: String?
    let page_width: Int?
    let page_height: Int?
    let is_current: Bool?

    var pickerLabel: String {
        let current = is_current == true ? "  ·  current" : ""
        return "\(sheet_number)  Rev \(revision)  ·  \(discipline)\(current)"
    }
}

struct PinDTO: Codable, Hashable {
    var x_norm: Double
    var y_norm: Double
    var label: String?
}

struct PhotoDTO: Codable {
    let filename: String
    let content_type: String
    let data_base64: String
}

struct OpenRFIDTO: Codable, Identifiable, Hashable {
    let id: String
    let project_id: String
    let status: String
    let subject: String
    let question: String
    let priority: String
    let rfi_display: String?
    let sheet_numbers: [String]
    let grids: [String]
}

struct SearchResponseDTO: Codable {
    let ok: Bool
    let count: Int
    let rfis: [OpenRFIDTO]
}

struct PreflightProject: Codable {
    let id: String
    let name: String
}

struct PreflightSheetRevision: Codable {
    let id: String
    let sheet_number: String
    let revision: String
    let discipline: String
}

struct PreflightEnvelope: Codable {
    let task: String
    let project: PreflightProject
    let sheet_revision: PreflightSheetRevision
    let pin: PinDTO?
    let photos: [PhotoDTO]
    let open_rfis_same_sheet: [OpenRFIBrief]
    let user_note: String
}

struct OpenRFIBrief: Codable {
    let id: String
    let subject: String
    let status: String
    let sheet_number: String?
    let grid: String?
}

struct DraftResultDTO: Codable {
    let ok: Bool
    let rfi_id: String?
    let status: String?
    let rfi_display: String?
    let missing_for_submit: [String]
    let message: String
    let duplicate: Bool
}

struct RFIDTO: Codable, Identifiable {
    let id: String
    let project_id: String
    let status: String
    let rfi_number: Int?
    let rfi_display: String?
    let subject: String
    let question: String
    let priority: String
    let work_stopped: Bool?
    let cost_impact: String
    let schedule_impact: String
    let proposed_solution: String?
    let assigned: String?
    let assigned_to_user_id: String?
    let assigned_to_company_id: String?
    let due_at: String?
    let submitted_at: String?
    let official_response: String?
    let responded_at: String?
    let pins: [RFIPinDetailDTO]?
    let refs: [RFIRefDetailDTO]?
    let missing_for_submit: [String]?
    let last_internal_review: Bool?
}

struct RFIPinDetailDTO: Codable, Identifiable {
    let id: String
    let sheet_revision_id: String
    let x_norm: Double
    let y_norm: Double
    let label: String?
}

struct RFIRefDetailDTO: Codable, Identifiable {
    let id: String
    let sheet_revision_id: String?
    let sheet_number: String?
    let revision: String?
    let discipline: String?
    let detail: String?
    let grid: String?
}

struct AssigneeUserDTO: Codable, Identifiable {
    let id: String
    let name: String
    let role: String
    let company_id: String?
    let company_name: String?
}

struct AssigneeCompanyDTO: Codable, Identifiable {
    let id: String
    let name: String
    let kind: String
}

struct AssigneeRosterDTO: Codable {
    let ok: Bool
    let users: [AssigneeUserDTO]
    let companies: [AssigneeCompanyDTO]
}

struct PEApproveResultDTO: Codable {
    let ok: Bool
    let rfi_id: String
    let status: String
    let rfi_display: String?
    let message: String
}

struct PESubmitBody: Codable {
    let priority: String
    let work_stopped: Bool
    let require_internal_review: Bool
    let assigned_to_user_id: String?
    let assigned_to_company_id: String?
    let assignee: String?
    let comment: String?
}

struct DesignAnswerBody: Codable {
    let official_response: String
}

struct DesignClarifyBody: Codable {
    let note: String
}

struct DesignActionResultDTO: Codable {
    let ok: Bool
    let rfi_id: String
    let status: String
    let rfi_display: String?
    let official_response: String?
    let responded_at: String?
    let assigned: String?
    let priority: String?
    let work_stopped: Bool
    let message: String
    let disclaimer: String
}

struct PESubmitResultDTO: Codable {
    let ok: Bool
    let rfi_id: String
    let status: String
    let rfi_display: String?
    let rfi_number: Int?
    let due_at: String?
    let submitted_at: String?
    let first_submit: Bool
    let assigned: String?
    let priority: String
    let work_stopped: Bool
    let due_at_rule: String
    let message: String
}

struct GraphRowDTO: Codable, Identifiable {
    let id: String
    let project_id: String
    let project_name: String
    let rfi_display: String?
    let rfi_number: Int?
    let subject: String
    let sheet_number: String?
    let status: String
    let priority: String
    let work_stopped: Bool
    let assigned: String?
    let due_at: String?
    let days_open: Int
    let age_bucket: String?
    let is_sample: Bool
    let is_draft: Bool
}

struct StatusMachineDTO: Codable {
    let main: [String]
    let branches: [String]
    let note: String
}

struct GraphResponseDTO: Codable {
    let ok: Bool
    let generated_at: String
    let timezone: String
    let days_open_rule: String
    let sample_notice: String
    let status_machine: StatusMachineDTO
    let bucket_order: [String]
    let bucket_counts: [String: Int]
    let open: [GraphRowDTO]
    let drafts: [GraphRowDTO]
    let closed_or_void_count: Int
}

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct PickedPhoto: Identifiable {
    let id = UUID()
    let filename: String
    let jpegData: Data
}
