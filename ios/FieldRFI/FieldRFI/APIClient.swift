import Foundation

struct APIClient {
    var baseURL: URL

    init(baseURL: URL = APIClient.defaultBaseURL) {
        self.baseURL = baseURL
    }

    static var defaultBaseURL: URL {
        URL(string: "http://127.0.0.1:8000")!
    }

    /// PE Submit screen only. Grok / New RFI never send these headers.
    static let peHeaders = [
        "X-Field-Actor": "pe",
        "X-PE-Token": "pe-demo",
    ]

    func projects() async throws -> [ProjectDTO] {
        try await get("/projects")
    }

    func sheetRevisions(projectID: String) async throws -> [SheetRevisionDTO] {
        try await get("/projects/\(projectID)/sheet-revisions")
    }

    func drawing(revisionID: String) async throws -> Data {
        let url = baseURL.appending(path: "/sheet-revisions/\(revisionID)/drawing")
        let (data, response) = try await URLSession.shared.data(from: url)
        try Self.validate(response, data: data)
        return data
    }

    func searchRFIs(
        projectID: String,
        query: String?,
        sheetNumber: String?,
        grid: String?,
        statusIn: String = "draft,submitted,ball_in_court",
        limit: Int = 10
    ) async throws -> SearchResponseDTO {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "project_id", value: projectID),
            URLQueryItem(name: "status_in", value: statusIn),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let query, !query.isEmpty {
            items.append(URLQueryItem(name: "query", value: query))
        }
        if let sheetNumber, !sheetNumber.isEmpty {
            items.append(URLQueryItem(name: "sheet_number", value: sheetNumber))
        }
        if let grid, !grid.isEmpty {
            items.append(URLQueryItem(name: "grid", value: grid))
        }
        return try await get("/search_rfis", query: items)
    }

    func createRFIDraft(_ envelope: PreflightEnvelope) async throws -> DraftResultDTO {
        try await post("/create_rfi_draft", body: envelope)
    }

    func rfi(id: String) async throws -> RFIDTO {
        try await get("/rfis/\(id)")
    }

    func peAssignees() async throws -> AssigneeRosterDTO {
        try await get("/pe/assignees", headers: Self.peHeaders)
    }

    func peApproveInternalReview(rfiID: String) async throws -> PEApproveResultDTO {
        try await post("/pe/rfis/\(rfiID)/approve_internal_review", body: EmptyBody(), headers: Self.peHeaders)
    }

    func peSubmit(rfiID: String, body: PESubmitBody) async throws -> PESubmitResultDTO {
        try await post("/pe/rfis/\(rfiID)/submit", body: body, headers: Self.peHeaders)
    }

    func rfiGraph(projectID: String? = nil) async throws -> GraphResponseDTO {
        var items: [URLQueryItem] = []
        if let projectID, !projectID.isEmpty {
            items.append(URLQueryItem(name: "project_id", value: projectID))
        }
        return try await get("/rfi_graph", query: items)
    }

    private func get<T: Decodable>(
        _ path: String,
        query: [URLQueryItem] = [],
        headers: [String: String] = [:]
    ) async throws -> T {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(
        _ path: String,
        body: Body,
        headers: [String: String] = [:]
    ) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private struct EmptyBody: Encodable {}

    private static func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "No HTTP response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            if let detail = try? JSONDecoder().decode(Detail.self, from: data) {
                throw APIError(message: detail.message)
            }
            let text = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw APIError(message: text)
        }
    }

    private struct Detail: Decodable {
        let message: String

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            if let text = try? container.decode(String.self, forKey: .detail) {
                message = text
                return
            }
            if let items = try? container.decode([Item].self, forKey: .detail) {
                message = items.map(\.msg).joined(separator: " ")
                return
            }
            message = "Request failed."
        }

        enum CodingKeys: String, CodingKey { case detail }

        struct Item: Decodable {
            let msg: String
        }
    }
}
