import Foundation

/// Existing mock crew names already in the app. Harbor* are people names only.
/// Job comes from the selected sample job. Do not invent new people.
enum ShopCrew {
    static var jobID: String { ShopSampleCatalog.selected.id }
    static var jobName: String { ShopSampleCatalog.selected.name }

    static let members: [CrewMemberDTO] = [
        member("aaaaaaaa-0000-4000-8000-000000000311", "Greg Castro", "general_foreman", reportsTo: nil, boss: nil),
        member("aaaaaaaa-0000-4000-8000-000000000321", "Harbor Area Foreman", "area_foreman", reportsTo: "aaaaaaaa-0000-4000-8000-000000000311", boss: "Greg Castro"),
        member("aaaaaaaa-0000-4000-8000-000000000322", "Harbor Foreman", "foreman", reportsTo: "aaaaaaaa-0000-4000-8000-000000000321", boss: "Harbor Area Foreman"),
        member("aaaaaaaa-0000-4000-8000-000000000323", "Harbor Journeyman", "journeyman", reportsTo: "aaaaaaaa-0000-4000-8000-000000000322", boss: "Harbor Foreman"),
        member("aaaaaaaa-0000-4000-8000-000000000324", "Harbor Apprentice", "apprentice", reportsTo: "aaaaaaaa-0000-4000-8000-000000000323", boss: "Harbor Journeyman"),
    ]

    static func member(byID id: String?) -> CrewMemberDTO? {
        guard let id else { return nil }
        return members.first(where: { $0.user_id == id })
    }

    static func isForemanRole(_ role: String) -> Bool {
        ["foreman", "area_foreman", "general_foreman"].contains(role)
    }

    static var foremen: [CrewMemberDTO] {
        members.filter { isForemanRole($0.role) }
    }

    static func rank(_ role: String) -> Int {
        switch role {
        case "general_foreman": return 0
        case "area_foreman": return 1
        case "foreman": return 2
        case "journeyman": return 3
        case "apprentice": return 4
        default: return 99
        }
    }

    static func isBelow(_ member: CrewMemberDTO, of boss: CrewMemberDTO) -> Bool {
        var current = member
        for _ in 0..<8 {
            guard let parentID = current.reports_to_user_id,
                  let parent = member(byID: parentID)
            else { return false }
            if parent.user_id == boss.user_id { return true }
            current = parent
        }
        return false
    }

    static func below(_ boss: CrewMemberDTO) -> [CrewMemberDTO] {
        members.filter { isBelow($0, of: boss) }
    }

    static func isDirectReport(_ member: CrewMemberDTO, of boss: CrewMemberDTO) -> Bool {
        member.reports_to_user_id == boss.user_id
    }

    static func directReports(of boss: CrewMemberDTO) -> [CrewMemberDTO] {
        members.filter { isDirectReport($0, of: boss) }
    }

    static func oneStepUp(from member: CrewMemberDTO) -> CrewMemberDTO? {
        member(byID: member.reports_to_user_id)
    }

    static func member(
        _ id: String,
        _ name: String,
        _ role: String,
        reportsTo: String?,
        boss: String?
    ) -> CrewMemberDTO {
        CrewMemberDTO(
            user_id: id,
            name: name,
            role: role,
            area_id: nil,
            area_name: jobName,
            reports_to_user_id: reportsTo,
            boss_name: boss,
            active: true
        )
    }
}
