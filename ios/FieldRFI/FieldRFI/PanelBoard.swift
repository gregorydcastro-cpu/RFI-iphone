import Foundation
import SwiftUI

/// On-device field tracker. G-Line Shop Test + E-101 Rev A only.
/// Pulled vs not pulled so a circuit is not missed.
/// Optional one-line note. Not a design log. Not a Procore sync. No HTTP.
struct CircuitChangeNote: Identifiable, Codable, Hashable {
    var id: String
    var text: String
    var createdByUserID: String
    var createdByName: String
    var createdAt: Date
}

struct PanelCircuit: Identifiable, Codable, Hashable {
    var id: String
    var number: String
    var description: String
    var pulled: Bool
    var pulledAt: Date?
    var pulledByName: String?
    var changeNotes: [CircuitChangeNote]

    static func blank(number: String = "", description: String = "") -> PanelCircuit {
        PanelCircuit(
            id: UUID().uuidString,
            number: number,
            description: description,
            pulled: false,
            pulledAt: nil,
            pulledByName: nil,
            changeNotes: []
        )
    }
}

struct PanelSchedule: Identifiable, Codable, Hashable {
    var id: String
    var jobID: String
    var jobName: String
    var name: String
    var sheetNumber: String
    var revision: String
    var circuits: [PanelCircuit]
    var updatedAt: Date

    var pulledCount: Int { circuits.filter(\.pulled).count }

    static func make(name: String) -> PanelSchedule {
        PanelSchedule(
            id: UUID().uuidString,
            jobID: MaterialListRecord.shopTestID,
            jobName: MaterialListRecord.shopTestName,
            name: name,
            sheetNumber: ShopSampleCatalog.sheetNumber,
            revision: ShopSampleCatalog.revision,
            circuits: [],
            updatedAt: Date()
        )
    }
}

enum PanelFillOutcome {
    case wrote(String)
    case failed(String)
}

@MainActor
final class PanelBoard: ObservableObject {
    static let shared = PanelBoard()

    @Published private(set) var panels: [PanelSchedule] = []

    private let key = "gcfieldlog.panels.v2"

    init() {
        load()
    }

    func panel(id: String) -> PanelSchedule? {
        panels.first(where: { $0.id == id })
    }

    @discardableResult
    func createPanel(name: String) -> PanelSchedule? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if panels.contains(where: { $0.name.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return nil
        }
        let row = PanelSchedule.make(name: trimmed)
        panels.insert(row, at: 0)
        save()
        return row
    }

    func addCircuit(panelID: String, number: String, description: String) -> PanelCircuit? {
        guard let index = panels.firstIndex(where: { $0.id == panelID }) else { return nil }
        let num = number.trimmingCharacters(in: .whitespacesAndNewlines)
        let desc = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !num.isEmpty else { return nil }
        if panels[index].circuits.contains(where: { $0.number.caseInsensitiveCompare(num) == .orderedSame }) {
            return nil
        }
        let row = PanelCircuit.blank(number: num, description: desc)
        panels[index].circuits.append(row)
        sortCircuits(at: index)
        save()
        return row
    }

    func editCircuit(panelID: String, circuitID: String, number: String, description: String) -> Bool {
        guard let p = panels.firstIndex(where: { $0.id == panelID }),
              let c = panels[p].circuits.firstIndex(where: { $0.id == circuitID })
        else { return false }
        let num = number.trimmingCharacters(in: .whitespacesAndNewlines)
        let desc = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !num.isEmpty else { return false }
        if panels[p].circuits.contains(where: {
            $0.id != circuitID && $0.number.caseInsensitiveCompare(num) == .orderedSame
        }) {
            return false
        }
        panels[p].circuits[c].number = num
        panels[p].circuits[c].description = desc
        sortCircuits(at: p)
        save()
        return true
    }

    func setPulled(panelID: String, circuitID: String, pulled: Bool, by: CrewMemberDTO?) {
        guard let p = panels.firstIndex(where: { $0.id == panelID }),
              let c = panels[p].circuits.firstIndex(where: { $0.id == circuitID })
        else { return }
        panels[p].circuits[c].pulled = pulled
        if pulled {
            panels[p].circuits[c].pulledAt = Date()
            panels[p].circuits[c].pulledByName = by?.name
        } else {
            panels[p].circuits[c].pulledAt = nil
            panels[p].circuits[c].pulledByName = nil
        }
        save()
    }

    @discardableResult
    func addChangeNote(panelID: String, circuitID: String, text: String, by: CrewMemberDTO?) -> CircuitChangeNote? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let p = panels.firstIndex(where: { $0.id == panelID }),
              let c = panels[p].circuits.firstIndex(where: { $0.id == circuitID })
        else { return nil }
        let note = CircuitChangeNote(
            id: UUID().uuidString,
            text: trimmed,
            createdByUserID: by?.user_id ?? "local-field",
            createdByName: by?.name ?? "Field",
            createdAt: Date()
        )
        panels[p].circuits[c].changeNotes.insert(note, at: 0)
        save()
        return note
    }

    /// Fill empty circuit numbers from the bundled sample. Does not invent if the sheet is missing.
    /// Leaves existing pulled marks and change notes alone.
    func fillFromSample(panelID: String) -> PanelFillOutcome {
        guard let index = panels.firstIndex(where: { $0.id == panelID }) else {
            return .failed("Pick a panel first.")
        }
        switch GrokTakeoff.suggestCircuits() {
        case .success(let result):
            var added = 0
            for suggestion in result.circuits {
                if panels[index].circuits.contains(where: {
                    $0.number.caseInsensitiveCompare(suggestion.number) == .orderedSame
                }) {
                    continue
                }
                panels[index].circuits.append(
                    PanelCircuit.blank(number: suggestion.number, description: suggestion.description)
                )
                added += 1
            }
            sortCircuits(at: index)
            save()
            if added == 0 {
                return .wrote("Sample circuits already on this panel. Nothing new written.")
            }
            return .wrote(result.message)
        case .failure(let failure):
            switch failure {
            case .noSheet:
                return .failed("No catalog sheet image. Fill did not write circuits.")
            case .noVisibleDevices:
                return .failed("Sheet is present but no plate fixtures are visible. Fill did not write circuits.")
            }
        }
    }

    private func sortCircuits(at index: Int) {
        panels[index].circuits.sort { lhs, rhs in
            let l = Int(lhs.number) ?? Int.max
            let r = Int(rhs.number) ?? Int.max
            if l != r { return l < r }
            return lhs.number.localizedStandardCompare(rhs.number) == .orderedAscending
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let rows = try? JSONDecoder().decode([PanelSchedule].self, from: data)
        else { return }
        panels = rows.filter { $0.jobID == MaterialListRecord.shopTestID }
    }

    private func save() {
        let now = Date()
        for i in panels.indices {
            panels[i].updatedAt = now
        }
        if let data = try? JSONEncoder().encode(panels) {
            UserDefaults.standard.set(data, forKey: key)
        }
        objectWillChange.send()
    }
}
