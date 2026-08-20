"""Later deny after role allow. Attribute wins; role permit is not enough."""

from __future__ import annotations

from uuid import UUID

import pytest

from abac import (
    AccessDenied,
    Action,
    ActorType,
    Env,
    Role,
    deny_log_fields,
    dump_walk,
    emit_audit_line,
    format_audit_line,
    raise_http,
    reject_audit_line,
    require_access,
    AUDIT_LINE_KEYS,
    DENY_LOG_FIELDS,
    WALK_DUMP_DROP,
    WALK_DUMP_KEYS,
    WALK_DUMP_STEP_KEYS,
)
from app.policy_coverage import EXPECTED_ORDER
from tests.conftest import (
    AREA,
    CREW,
    JOB,
    OTHER,
    OTHER_AREA,
    USER,
    assert_stop,
    evaluate,
    first_stop,
    gold_rows,
    names,
    resource,
    subject,
)


def test_other_area_denies_after_role_allow(cov):
    decision, steps = evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    )
    cov.record((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:5])
    assert_stop(steps, "area_scope")
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert decision.policy == "area_scope"


def test_journeyman_other_area_later_deny_wins(cov):
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN, area_id=AREA),
        Action.CREATE_RFI_DRAFT,
        resource(area_id=OTHER_AREA),
    )
    cov.record((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:5])
    assert_stop(steps, "area_scope")
    assert "assigned_only" not in names((decision, steps))
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert first_stop((decision, steps)).reason == "outside your area"
    assert decision.policy == "area_scope"


def test_other_crew_denies_after_role_allow(cov):
    from fastapi import HTTPException

    other = resource(created_by_id=OTHER, crew_foreman_id=OTHER)
    decision, steps = evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        other,
    )
    cov.record((decision, steps))
    assert gold_rows((decision, steps)) == [
        (1, "same_project", "n/a"),
        (2, "grokbot_lane", "n/a"),
        (3, "on_site", "n/a"),
        (4, "role_allows", "ALLOW", "foreman may submit_rfi"),
        (5, "area_scope", "n/a"),
        (6, "assigned_only", "n/a"),
        (7, "chain_owns", "DENY", "not your crew's ticket", "STOP"),
    ]
    assert_stop(steps, "chain_owns")
    assert first_stop((decision, steps)).reason == "not your crew's ticket"
    with pytest.raises(AccessDenied) as raised:
        require_access(
            subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
            Action.SUBMIT_RFI,
            other,
        )
    cov.record(raised.value)
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.detail == {
        "policy": "chain_owns",
        "reason": "not your crew's ticket",
    }


def test_assigned_only_denies_after_role_allow(cov):
    decision, steps = evaluate(
        subject(role=Role.APPRENTICE),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=None),
    )
    cov.record((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:6])
    assert_stop(steps, "assigned_only")
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert first_stop((decision, steps)).reason == "not your ticket"
    assert decision.policy == "assigned_only"


def test_apprentice_other_ticket_stops_at_assigned_only(cov):
    decision, steps = evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER),
    )
    cov.record((decision, steps))
    assert_stop(steps, "assigned_only")
    assert "chain_owns" not in names((decision, steps))


def test_off_site_pin_stops_before_role(cov):
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    )
    cov.record((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:3])
    assert_stop(steps, "on_site")
    assert "role_allows" not in names((decision, steps))


def test_work_stopped_demote_without_flag(cov):
    from fastapi import HTTPException

    stopped = resource(
        priority="work_stopped", work_stopped=True, status="ball_in_court"
    )
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SET_PRIORITY,
        stopped,
        ctx={"priority": "standard", "allow_demote": False},
    )
    cov.record((decision, steps))
    rows = gold_rows((decision, steps))
    assert (4, "role_allows", "ALLOW", "general_foreman may set_priority") in rows
    assert rows[-1] == (
        9,
        "work_stop_writer",
        "DENY",
        "demote of work_stopped requires allow_demote",
        "STOP",
    )
    assert_stop(steps, "work_stop_writer")
    with pytest.raises(AccessDenied) as raised:
        require_access(
            subject(role=Role.GENERAL_FOREMAN),
            Action.SET_PRIORITY,
            stopped,
            ctx={"priority": "standard", "allow_demote": False},
        )
    cov.record(raised.value)
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.detail == {
        "policy": "work_stop_writer",
        "reason": "demote of work_stopped requires allow_demote",
    }


def test_answered_submit_stops_at_status(cov):
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    )
    cov.record((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:8])
    assert_stop(steps, "status_guard")
    assert decision.policy == "status_guard"


def test_deny_audit_line_is_law(caplog):
    import logging

    from abac import audit_logs

    other = resource(created_by_id=OTHER, crew_foreman_id=OTHER)
    with caplog.at_level(logging.INFO, logger="abac"):
        with pytest.raises(AccessDenied):
            require_access(
                subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
                Action.SUBMIT_RFI,
                other,
            )
    log = audit_logs()[-1]
    line = (
        f"abac deny action=submit_rfi role=foreman actor=human "
        f"policy=chain_owns project={JOB}"
    )
    assert format_audit_line(log) == line
    reject_audit_line(line)
    assert AUDIT_LINE_KEYS == ("action", "role", "actor", "policy", "project")
    assert DENY_LOG_FIELDS == ("policy", "action", "role", "actor_type", "project_id", "seq")
    assert deny_log_fields(log) == {
        "policy": "chain_owns",
        "action": "submit_rfi",
        "role": "foreman",
        "actor_type": "human",
        "project_id": str(JOB),
        "seq": 7,
    }
    recorded = next(item for item in caplog.records if item.message == line)
    assert recorded.seq == 7
    assert line in caplog.messages


def test_allow_audit_line_for_submit_and_set_priority(caplog):
    import logging

    from abac import audit_logs

    with caplog.at_level(logging.INFO, logger="abac"):
        require_access(subject(role=Role.GENERAL_FOREMAN), Action.SUBMIT_RFI, resource())
        require_access(
            subject(role=Role.GENERAL_FOREMAN),
            Action.SET_PRIORITY,
            resource(),
            ctx={"priority": "urgent"},
        )
        require_access(subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, resource())
    submit = (
        f"abac allow action=submit_rfi role=general_foreman actor=human "
        f"policy=role_allows project={JOB}"
    )
    priority = (
        f"abac allow action=set_priority role=general_foreman actor=human "
        f"policy=role_allows project={JOB}"
    )
    draft = (
        f"abac allow action=create_rfi_draft role=journeyman actor=human "
        f"policy=role_allows project={JOB}"
    )
    logs = audit_logs()
    assert format_audit_line(logs[-3]) == submit
    assert format_audit_line(logs[-2]) == priority
    assert format_audit_line(logs[-1]) == draft
    assert submit in caplog.messages
    assert priority in caplog.messages
    assert draft not in caplog.messages
    assert emit_audit_line(logs[-1]) == draft


def test_walk_dump_keeps_machine_fields_only():
    decision, steps = evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    dumped = dump_walk(
        decision,
        steps,
        action=Action.SUBMIT_RFI,
        role=Role.FOREMAN,
        actor_type=ActorType.HUMAN,
    )
    assert dumped["decision.policy"] == "chain_owns"
    assert set(dumped["steps"][0]) == set(WALK_DUMP_STEP_KEYS)
    blob = str(dumped)
    for dropped in WALK_DUMP_DROP:
        assert dropped not in blob
    assert "not your crew's ticket" not in blob
    assert WALK_DUMP_KEYS[-1] == "actor_type"


def test_chain_owns_denies_differ_by_resource_id_and_area():
    from abac import audit_logs

    left_id = UUID("00000000-0000-4000-8000-000000000701")
    right_id = UUID("00000000-0000-4000-8000-000000000702")
    left = resource(
        id=left_id,
        area_id=AREA,
        created_by_id=OTHER,
        crew_foreman_id=OTHER,
    )
    right = resource(
        id=right_id,
        area_id=OTHER_AREA,
        created_by_id=OTHER,
        crew_foreman_id=OTHER,
    )
    with pytest.raises(AccessDenied):
        require_access(
            subject(role=Role.FOREMAN, area_id=AREA, crew_ids=frozenset({CREW})),
            Action.SUBMIT_RFI,
            left,
        )
    with pytest.raises(AccessDenied):
        require_access(
            subject(role=Role.FOREMAN, area_id=OTHER_AREA, crew_ids=frozenset({CREW})),
            Action.SUBMIT_RFI,
            right,
        )
    first, second = audit_logs()[-2:]
    assert first.decision.policy == second.decision.policy == "chain_owns"
    assert first.resource_id == left_id
    assert second.resource_id == right_id
    assert first.area_id == AREA
    assert second.area_id == OTHER_AREA
