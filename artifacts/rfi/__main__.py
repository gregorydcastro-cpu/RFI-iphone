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
        facts["grok_enter"] == "grokbot_lane",
        facts["grok_close"] == "grokbot_lane",
        facts["work_stopped_after_enter"] is True,
        facts["close_while_stopped"] is not None,
        facts["mo_status"] == "draft",
        facts["mo_asked"] == facts["rev_a"].id,
        facts["mo_current"] == facts["rev_b"].id,
        facts["closed_status"] == "closed",
        facts["due_unchanged"] is True,
        facts["number_unchanged"] is True,
        facts["leftover_still_draft"] is True,
        facts["leftover_draft"].id in facts["preflight_leftover_ids"],
        facts["rfi"].id in facts["preflight_carried_ids"],
        facts["grok_leftover_id"] == facts["leftover_draft"].id,
        facts["grok_carried_id"] == facts["rfi"].id,
        facts["grok_fresh_status"] == "draft",
        facts["grok_fresh_number"] is None,
        facts["preflight_did_not_spawn"] is True,
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
    print(
        "preflight: grok leftover/carried matches returned; "
        f"fresh draft {facts['grok_fresh_status']} number=None"
    )
    print(
        f"impact_review: grok MO draft {facts['mo_status']}; "
        f"AF cleared stop and closed; leftover still draft"
    )
    if not all(checks):
        raise SystemExit("demo path failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
