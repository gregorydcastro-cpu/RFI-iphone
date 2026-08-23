import Foundation

/// Existing mock crew names already in the app. Job stays G-Line Shop Test.
/// Do not invent a new job or new people.
enum ShopCrew {
    static let jobID = MaterialListRecord.shopTestID
    static let jobName = MaterialListRecord.shopTestName

    static let members: [CrewMemberDTO] = [
        member("aaaaaaaa-0000-4000-8000-000000000311", "Greg Castro", "general_foreman", reportsTo: nil, boss: nil),
        member("aaaaaaaa-0000-4000-8000-000000000321", "Harbor Area Foreman", "area_foreman", reportsTo: "aaaaaaaa-0000-4000-8000-000000000311", boss: "Greg Castro"),
        member("aaaaaaaa-0000-4000-8000-000000000322", "Harbor Foreman", "foreman", reportsTo: "aaaaaaaa-0000-4000-8000-000000000321", boss: "Harbor Area Foreman"),
        member("aaaaaaaa-0000-4000-8000-000000000323", "Harbor Journeyman", "journeyman", reportsTo: "aaaaaaaa-0000-4000-8000-000000000322", boss: "Harbor Foreman"),
        member("aaaaaaaa-0000-4000-8000-000000000324", "Harbor Apprentice", "apprentice", reportsTo: "aaaaaaaa-0000-4000-8000-000000000323", boss: "Harbor Journeyman"),
    ]

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
