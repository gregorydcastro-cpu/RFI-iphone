import Foundation

struct APIClient {
    static let baseURLInfoKey = "FIELD_API_BASE_URL"

    var baseURL: URL

    init(baseURL: URL = APIClient.defaultBaseURL) {
        self.baseURL = baseURL
    }

    /// Empty is legal. v1 send-to-foreman is local and needs no host.
    /// Debug may use localhost HTTP when a caller actually hits the server.
    static let localOnlyMarker = URL(string: "field-rfi://local")!

    static var defaultBaseURL: URL {
        configuredBaseURL() ?? debugOrLocalMarker
    }

    static var defaultBaseURLString: String {
        configuredBaseURL()?.absoluteString ?? {
            #if DEBUG
            return "http://127.0.0.1:8000"
            #else
            return ""
            #endif
        }()
    }

    /// Info.plist has a non-empty URL. Empty Release is legal; local outbox does not need this.
    static var hasServerHost: Bool {
        configuredBaseURL() != nil
    }

    static func isMissingHost(_ error: Error) -> Bool {
        (error as? APIError)?.message.contains("No API host") == true
    }

    private static var debugOrLocalMarker: URL {
        #if DEBUG
        return URL(string: "http://127.0.0.1:8000")!
        #else
        return localOnlyMarker
        #endif
    }

    static func configuredBaseURL() -> URL? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: baseURLInfoKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !raw.isEmpty, let url = URL(string: raw), url.scheme != nil else {
            return nil
        }
        return url
    }

    /// Fail closed only when a caller needs a server.
    static func assertReleaseBaseURL(_ url: URL) throws {
        #if DEBUG
        _ = url
        #else
        let host = url.host?.lowercased() ?? ""
        let scheme = url.scheme?.lowercased() ?? ""
        let closed = scheme != "https"
            || host.isEmpty
            || host == "localhost"
            || host == "127.0.0.1"
            || scheme == "field-rfi"
        if closed {
            throw APIError(
                message: "No API host. Send-to-foreman is local. This action needs https:// FIELD_API_BASE_URL — not http, not localhost."
            )
        }
        #endif
    }

    /// Actor screens only. Grok / New RFI never send these headers.
    static let peHeaders = [
        "X-Field-Actor": "pe",
        "X-PE-Token": "pe-demo",
    ]
    static let designHeaders = [
        "X-Field-Actor": "design",
        "X-Design-Token": "design-demo",
    ]
    static let gcHeaders = [
        "X-Field-Actor": "gc",
        "X-GC-Token": "gc-demo",
    ]

    func projects() async throws -> [ProjectDTO] {
        try await get("/projects")
    }

    func sheetRevisions(projectID: String) async throws -> [SheetRevisionDTO] {
        try await get("/projects/\(projectID)/sheet-revisions")
    }

    func drawing(revisionID: String) async throws -> Data {
        try Self.assertReleaseBaseURL(baseURL)
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

    func crew(projectID: String) async throws -> CrewDTO {
        try await get("/projects/\(projectID)/crew")
    }

    func assignment(projectID: String, userID: String) async throws -> AssignmentDTO {
        try await get(
            "/me/assignment",
            query: [
                URLQueryItem(name: "project_id", value: projectID),
                URLQueryItem(name: "user_id", value: userID),
            ]
        )
    }

    func fieldTickets(projectID: String, userID: String) async throws -> MaterialTicketsDTO {
        try await get(
            "/field/tickets",
            query: [
                URLQueryItem(name: "project_id", value: projectID),
                URLQueryItem(name: "user_id", value: userID),
            ]
        )
    }

    func handleTicket(id: String, headers: [String: String]) async throws -> MaterialTicketDTO {
        try await post("/field/material_orders/\(id)/handle", body: EmptyBody(), headers: headers)
    }

    func flagTicket(id: String, note: String, kind: String, headers: [String: String]) async throws {
        struct FlagBody: Encodable {
            let note: String
            let kind: String
        }
        let _: [String: Bool] = try await post(
            "/field/material_orders/\(id)/flag",
            body: FlagBody(note: note, kind: kind),
            headers: headers
        )
    }

    func rfi(id: String) async throws -> RFIDTO {
        try await get("/rfis/\(id)")
    }

    func peAssignees() async throws -> AssigneeRosterDTO {
        try await get("/pe/assignees", headers: Self.peHeaders)
    }

    func peApproveInternalReview(rfiID: String, extraHeaders: [String: String] = [:]) async throws -> PEApproveResultDTO {
        var headers = Self.peHeaders
        extraHeaders.forEach { headers[$0] = $1 }
        return try await post("/pe/rfis/\(rfiID)/approve_internal_review", body: EmptyBody(), headers: headers)
    }

    func peSubmit(rfiID: String, body: PESubmitBody, extraHeaders: [String: String] = [:]) async throws -> PESubmitResultDTO {
        var headers = Self.peHeaders
        extraHeaders.forEach { headers[$0] = $1 }
        return try await post("/pe/rfis/\(rfiID)/submit", body: body, headers: headers)
    }

    func designOfficialResponse(rfiID: String, text: String) async throws -> DesignActionResultDTO {
        try await post(
            "/design/rfis/\(rfiID)/official_response",
            body: DesignAnswerBody(official_response: text),
            headers: Self.designHeaders
        )
    }

    func designRequestClarification(rfiID: String, note: String) async throws -> DesignActionResultDTO {
        try await post(
            "/design/rfis/\(rfiID)/request_clarification",
            body: DesignClarifyBody(note: note),
            headers: Self.designHeaders
        )
    }

    func gcStartImpactReview(rfiID: String) async throws -> DesignActionResultDTO {
        try await post(
            "/gc/rfis/\(rfiID)/start_impact_review",
            body: EmptyBody(),
            headers: Self.gcHeaders
        )
    }

    func gcDraftChangeOrder(rfiID: String, body: GCDraftChangeOrderBody) async throws -> GCDraftResultDTO {
        try await post("/gc/rfis/\(rfiID)/draft_change_order", body: body, headers: Self.gcHeaders)
    }

    func gcDraftMaterialOrder(rfiID: String, body: GCDraftMaterialOrderBody) async throws -> GCDraftResultDTO {
        try await post("/gc/rfis/\(rfiID)/draft_material_order", body: body, headers: Self.gcHeaders)
    }

    func gcClose(rfiID: String) async throws -> DesignActionResultDTO {
        try await post("/gc/rfis/\(rfiID)/close", body: EmptyBody(), headers: Self.gcHeaders)
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
        try Self.assertReleaseBaseURL(baseURL)
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
        try Self.assertReleaseBaseURL(baseURL)
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
