import Foundation

/// On-device sample only. G-Line Shop Test + E-101 Rev A.
/// G-Line Shop Test and E-101 Rev A only. No HTTP.
enum ShopSampleCatalog {
    static let projectID = MaterialListRecord.shopTestID
    static let projectName = MaterialListRecord.shopTestName
    static let sheetNumber = "E-101"
    static let revision = "A"
    static let sheetTitle = "Sample lighting plan"
    static let resource = "e-101-rev-a"
    static let takeoffTag = "E-101 Rev A takeoff"

    static var project: ProjectDTO {
        ProjectDTO(
            id: projectID,
            name: projectName,
            organization_name: "Sample",
            address: nil,
            architect: nil,
            project_number: nil
        )
    }

    static var sheetRevision: SheetRevisionDTO {
        SheetRevisionDTO(
            id: "g-line-e-101-rev-a",
            sheet_id: "g-line-e-101",
            sheet_number: sheetNumber,
            revision: revision,
            discipline: "E",
            title: sheetTitle,
            drawing_url: "",
            file_url: nil,
            page_width: 1800,
            page_height: 1200,
            is_current: true
        )
    }

    static func drawingData() -> Data? {
        guard let url = sheetURL() else { return nil }
        return try? Data(contentsOf: url)
    }

    static func sheetURL() -> URL? {
        let bundle = Bundle.main
        if let url = bundle.url(forResource: resource, withExtension: "png") {
            return url
        }
        if let url = bundle.url(forResource: resource, withExtension: "png", subdirectory: "Catalog") {
            return url
        }
        if let url = bundle.url(forResource: resource, withExtension: "png", subdirectory: "FieldRFI/Catalog") {
            return url
        }
        return nil
    }

    static func isBlockedProject(_ project: ProjectDTO) -> Bool {
        false
    }

    static func isBlockedRevision(_ revision: SheetRevisionDTO) -> Bool {
        false
    }

    static func allowedProjects(_ rows: [ProjectDTO]) -> [ProjectDTO] {
        var out = rows.filter { !isBlockedProject($0) }
        if !out.contains(where: { $0.id == projectID || $0.name == projectName }) {
            out.insert(project, at: 0)
        }
        return out
    }

    static func allowedRevisions(_ rows: [SheetRevisionDTO], project: ProjectDTO) -> [SheetRevisionDTO] {
        var out = rows.filter { !isBlockedRevision($0) }
        if project.id == projectID || project.name == projectName {
            if !out.contains(where: { $0.sheet_number == sheetNumber && $0.revision == revision }) {
                out.insert(sheetRevision, at: 0)
            }
        }
        return out
    }

    static func pickProject(_ rows: [ProjectDTO]) -> ProjectDTO? {
        rows.first(where: { $0.id == projectID || $0.name == projectName }) ?? rows.first
    }

    static func pickRevision(_ rows: [SheetRevisionDTO]) -> SheetRevisionDTO? {
        rows.first(where: { $0.sheet_number == sheetNumber && $0.revision == revision })
            ?? rows.first(where: { $0.is_current == true })
            ?? rows.first
    }
}
