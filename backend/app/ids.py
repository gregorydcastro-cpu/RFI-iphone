"""Stable demo UUIDs so the iOS simulator and tests share one catalog."""

from uuid import UUID

ORG_ID = UUID("aaaaaaaa-0000-4000-8000-000000000001")
PROJECT_ID = UUID("aaaaaaaa-0000-4000-8000-000000000010")
SETTINGS_ID = UUID("aaaaaaaa-0000-4000-8000-000000000011")
DRAWING_SET_ID = UUID("aaaaaaaa-0000-4000-8000-000000000020")
SHEET_S301_ID = UUID("aaaaaaaa-0000-4000-8000-000000000031")
SHEET_S302_ID = UUID("aaaaaaaa-0000-4000-8000-000000000032")
REV_S301_B_ID = UUID("aaaaaaaa-0000-4000-8000-000000000041")
REV_S301_C_ID = UUID("aaaaaaaa-0000-4000-8000-000000000042")
REV_S302_A_ID = UUID("aaaaaaaa-0000-4000-8000-000000000043")
LOC_GRID_B4_ID = UUID("aaaaaaaa-0000-4000-8000-000000000051")

DEMO_PROJECT_NAME = "Harbor Yard Warehouse"
DEMO_ORG_NAME = "Castro Construction"

# Brown ILSB — Greg's EL107_N Rev 27 / Bulletin 46 print
ILSB_ORG_ID = UUID("aaaaaaaa-0000-4000-8000-000000000101")
ILSB_PROJECT_ID = UUID("aaaaaaaa-0000-4000-8000-000000000110")
ILSB_SETTINGS_ID = UUID("aaaaaaaa-0000-4000-8000-000000000111")
ILSB_SET_ID = UUID("aaaaaaaa-0000-4000-8000-000000000120")
ILSB_SHEET_EL107_ID = UUID("aaaaaaaa-0000-4000-8000-000000000131")
ILSB_REV_27_ID = UUID("aaaaaaaa-0000-4000-8000-000000000141")
ILSB_LOC_ID = UUID("aaaaaaaa-0000-4000-8000-000000000151")
ILSB_RFI_ID = UUID("aaaaaaaa-0000-4000-8000-000000000161")

ILSB_ORG_NAME = "Brown University"
ILSB_PROJECT_NAME = "Brown Integrated Life Sciences Building (ILSB)"
ILSB_ADDRESS = "233 Richmond St, Providence RI 02903"
ILSB_ARCHITECT = "TenBerke"
ILSB_PROJECT_NO = "4224"
ILSB_SHEET_NUMBER = "EL107_N"
ILSB_REVISION = "27"
ILSB_PIN_X = 0.28
ILSB_PIN_Y = 0.52
ILSB_PIN_LABEL = "Gnotobiotics / isolation cubicles"

ILSB_SUBJECT = "Vivarium lighting control — which E-803 revision for EL107_N"
ILSB_QUESTION = (
    "EL107_N (Electrical Lighting Plan, Level 07 North; drawing history through "
    "Bulletin 46 dated 06/25/2026) hatches areas served by the vivarium lighting "
    "control system and says refer to E-803 for additional details. Which E-803 "
    "revision governs the Level 07 North gnotobiotics and isolation-cubicle zones "
    "on this sheet?"
)
ILSB_PROPOSED = (
    "Issue or confirm the E-803 revision that matches Bulletin 46 / this EL107_N, "
    "and note it on the lighting-control legend."
)
ILSB_PREFLIGHT_NOTES = (
    "Live RFIs were not available from Greg's other jobs."
)

# PE-seeded SAMPLE meeting-log RFIs (Harbor Yard). Not live field RFIs.
SAMPLE_OVERDUE_ID = UUID("aaaaaaaa-0000-4000-8000-000000000201")
SAMPLE_DUE_SOON_ID = UUID("aaaaaaaa-0000-4000-8000-000000000202")
SAMPLE_WORK_STOPPED_ID = UUID("aaaaaaaa-0000-4000-8000-000000000203")
SAMPLE_CLARIFY_ID = UUID("aaaaaaaa-0000-4000-8000-000000000204")
SAMPLE_IMPACT_WS_ID = UUID("aaaaaaaa-0000-4000-8000-000000000205")
SAMPLE_CLOSED_ID = UUID("aaaaaaaa-0000-4000-8000-000000000206")
SAMPLE_MISSING_DUE_ID = UUID("aaaaaaaa-0000-4000-8000-000000000207")
SAMPLE_ON_CYCLE_ID = UUID("aaaaaaaa-0000-4000-8000-000000000208")
SAMPLE_ANSWERED_ID = UUID("aaaaaaaa-0000-4000-8000-000000000209")
SAMPLE_VOID_ID = UUID("aaaaaaaa-0000-4000-8000-000000000210")
