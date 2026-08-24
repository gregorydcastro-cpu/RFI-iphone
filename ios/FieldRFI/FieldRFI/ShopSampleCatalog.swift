import Foundation

/// On-device sample jobs only. Not live sites. No HTTP. No Procore.
/// Takeoff and panel fill use only that job’s bundled fake sheet.
struct SampleJob: Identifiable, Hashable {
    let id: String
    let name: String
    let sheetID: String
    let revisionID: String
    let sheetNumber: String
    let revision: String
    let sheetTitle: String
    let resource: String
    let takeoffTag: String

    var project: ProjectDTO {
        ProjectDTO(
            id: id,
            name: name,
            organization_name: "Sample",
            address: nil,
            architect: nil,
            project_number: nil
        )
    }

    var sheetRevision: SheetRevisionDTO {
        SheetRevisionDTO(
            id: revisionID,
            sheet_id: sheetID,
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

    func drawingData() -> Data? {
        ShopSampleCatalog.drawingData(resource: resource)
    }

    func sheetURL() -> URL? {
        ShopSampleCatalog.sheetURL(resource: resource)
    }
}

enum ShopSampleCatalog {
    static let selectedJobKey = "gcfieldlog.selectedJob.v1"

    static let jobs: [SampleJob] = [
        SampleJob(
            id: "g-line-shop-test",
            name: "G-Line Shop Test",
            sheetID: "g-line-e-101",
            revisionID: "g-line-e-101-rev-a",
            sheetNumber: "E-101",
            revision: "A",
            sheetTitle: "Sample lighting plan",
            resource: "e-101-rev-a",
            takeoffTag: "G-Line Shop Test E-101 Rev A takeoff"
        ),
        SampleJob(
            id: "cedar-lot-sample",
            name: "Cedar Lot Sample",
            sheetID: "cedar-lot-e-101",
            revisionID: "cedar-lot-e-101-rev-a",
            sheetNumber: "E-101",
            revision: "A",
            sheetTitle: "Sample lighting plan",
            resource: "cedar-lot-e-101-rev-a",
            takeoffTag: "Cedar Lot Sample E-101 Rev A takeoff"
        ),
        SampleJob(
            id: "mill-street-mock",
            name: "Mill Street Mock",
            sheetID: "mill-street-e-101",
            revisionID: "mill-street-e-101-rev-a",
            sheetNumber: "E-101",
            revision: "A",
            sheetTitle: "Sample lighting plan",
            resource: "mill-street-e-101-rev-a",
            takeoffTag: "Mill Street Mock E-101 Rev A takeoff"
        ),
    ]

    static let shopTest = jobs[0]

    static var selectedJobID: String {
        get {
            let saved = UserDefaults.standard.string(forKey: selectedJobKey)
            if let saved, jobs.contains(where: { $0.id == saved }) {
                return saved
            }
            return shopTest.id
        }
        set {
            guard jobs.contains(where: { $0.id == newValue }) else { return }
            UserDefaults.standard.set(newValue, forKey: selectedJobKey)
        }
    }

    static var selected: SampleJob { job(id: selectedJobID) }

    static var projects: [ProjectDTO] { jobs.map(\.project) }

    static func job(id: String?) -> SampleJob {
        jobs.first(where: { $0.id == id }) ?? shopTest
    }

    static func job(matching project: ProjectDTO) -> SampleJob? {
        jobs.first(where: { $0.id == project.id || $0.name == project.name })
    }

    static func job(matchingRevision revision: SheetRevisionDTO, project: ProjectDTO?) -> SampleJob? {
        if let project, let match = job(matching: project) {
            if match.sheetNumber == revision.sheet_number && match.revision == revision.revision {
                return match
            }
            if match.revisionID == revision.id {
                return match
            }
        }
        return jobs.first(where: { $0.revisionID == revision.id })
    }

    /// Selected job. Prefer `selected` when more than the id is needed.
    static var projectID: String { selected.id }
    static var projectName: String { selected.name }
    static var sheetNumber: String { selected.sheetNumber }
    static var revision: String { selected.revision }
    static var sheetTitle: String { selected.sheetTitle }
    static var resource: String { selected.resource }
    static var takeoffTag: String { selected.takeoffTag }

    static var project: ProjectDTO { selected.project }
    static var sheetRevision: SheetRevisionDTO { selected.sheetRevision }

    static func drawingData() -> Data? {
        selected.drawingData()
    }

    static func drawingData(resource: String) -> Data? {
        guard let url = sheetURL(resource: resource) else { return nil }
        return try? Data(contentsOf: url)
    }

    static func sheetURL() -> URL? {
        selected.sheetURL()
    }

    static func sheetURL(resource: String) -> URL? {
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
        for job in jobs where !out.contains(where: { $0.id == job.id || $0.name == job.name }) {
            out.append(job.project)
        }
        let sample = jobs.compactMap { job in
            out.first(where: { $0.id == job.id || $0.name == job.name })
        }
        let rest = out.filter { row in
            !jobs.contains(where: { $0.id == row.id || $0.name == row.name })
        }
        return sample + rest
    }

    static func allowedRevisions(_ rows: [SheetRevisionDTO], project: ProjectDTO) -> [SheetRevisionDTO] {
        var out = rows.filter { !isBlockedRevision($0) }
        if let job = job(matching: project) {
            if !out.contains(where: { $0.id == job.revisionID || ($0.sheet_number == job.sheetNumber && $0.revision == job.revision) }) {
                out.insert(job.sheetRevision, at: 0)
            }
        }
        return out
    }

    static func pickProject(_ rows: [ProjectDTO]) -> ProjectDTO? {
        let job = selected
        return rows.first(where: { $0.id == job.id || $0.name == job.name }) ?? rows.first
    }

    static func pickRevision(_ rows: [SheetRevisionDTO], project: ProjectDTO? = nil) -> SheetRevisionDTO? {
        if let job = project.flatMap(job(matching:)) {
            if let match = rows.first(where: { $0.id == job.revisionID || ($0.sheet_number == job.sheetNumber && $0.revision == job.revision) }) {
                return match
            }
        }
        let job = selected
        return rows.first(where: { $0.id == job.revisionID || ($0.sheet_number == job.sheetNumber && $0.revision == job.revision) })
            ?? rows.first(where: { $0.is_current == true })
            ?? rows.first
    }
}
