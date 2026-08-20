"""cd artifacts && PYTHONPATH=. python -m rfi"""

from rfi.core import run_demo


def main() -> int:
    facts = run_demo()
    checks = (
        facts["draft_status"] == "draft",
        facts["draft_number"] is None,
        facts["pin"] == {"label": "A-3"},
        facts["grokbot_policy"] == "grokbot_lane",
        facts["display"] == "RFI-1",
        facts["status"] == "ball_in_court",
        facts["internal_review"] is True,
        facts["priority"] == "work_stopped",
        facts["work_stopped"] is True,
        facts["pair_holds"] is True,
        facts["cycle_events"] == 1,
        facts["cycle_kind"] == "escalated",
        facts["replay"] == 0,
        facts["carried_pins"] == 1,
        facts["pin_carried_events"] == 1,
        facts["leftover_still_on_old"] is True,
        facts["carried_has_both_revs"] is True,
        facts["leftover_draft"].id in facts["leftover"],
        facts["rfi"].id in facts["carry"],
        facts["leftover_draft"].id in facts["search_open_ids"],
        facts["rfi"].id in facts["search_open_ids"],
    )
    print("journeyman drafted on pin A-3 status=draft number=None")
    print(f"grokbot submit blocked policy={facts['grokbot_policy']}")
    print(f"foreman submitted {facts['display']} status={facts['status']}")
    print("area foreman set work-stopped pair_holds=True due reset")
    print(
        f"age_rfis wrote {facts['cycle_events']} {facts['cycle_kind']} "
        f"replay={facts['replay']}"
    )
    print(
        f"compare carried {facts['carried_pins']} pin; "
        f"leftover drafts stay on rev 27; pin_carried x2 is no-op"
    )
    if not all(checks):
        raise SystemExit("demo path failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
