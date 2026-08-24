import Foundation

@MainActor
final class RFIGraphViewModel: ObservableObject {
    @Published var baseURLString = APIClient.defaultBaseURLString
    @Published var graph: GraphResponseDTO?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var client: APIClient {
        APIClient(baseURL: URL(string: baseURLString) ?? APIClient.defaultBaseURL)
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            graph = try await client.rfiGraph()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
