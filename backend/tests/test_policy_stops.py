"""Gold traces. These lock the walk, not just allow/deny."""

from __future__ import annotations

from uuid import UUID

import pytest

from abac import (
    AccessDenied,
    Action,
    ActorType,
    Effect,
    Env,
    EvaluationTrace,
    FIELD_POLICY_SET,
    Resource,
    Role,
    Subject,
    evaluate,
    reject_frozen_env_now,
    reject_subject_crew_ids,
    require_access,
)
from app.policy_coverage import EXPECTED_ORDER, PolicyCoverage, _traces

JOB = UUID("00000000-0000-4000-8000-000000000010")
OTHER_JOB = UUID("00000000-0000-4000-8000-000000000110")
AREA = UUID("00000000-0000-4000-8000-000000000401")
OTHER_AREA = UUID("00000000-0000-4000-8000-000000000402")
USER = UUID("00000000-0000-4000-8000-000000000001")
CREW = UUID("00000000-0000-4000-8000-000000000002")
OTHER = UUID("00000000-0000-4000-8000-000000000003")
COMPANY = UUID("00000000-0000-4000-8000-000000000301")


def subject(
    *,
    role: Role = Role.JOURNEYMAN,
    actor_type: ActorType = ActorType.HUMAN,
    project_id: UUID = JOB,
    area_id: UUID | None = AREA,
    user_id: UUID = USER,
    crew_ids: frozenset[UUID] | None = None,
    reports_to_id: UUID | None = None,
    company_id: UUID = COMPANY,
) -> Subject:
    return Subject(
        user_id=user_id,
        company_id=company_id,
        project_id=project_id,
        role=role,
        area_id=area_id,
        reports_to_id=reports_to_id,
        actor_type=actor_type,
        crew_ids=crew_ids if crew_ids is not None else frozenset(),
    )


def resource(
    *,
    type: str = "rfi",
    project_id: UUID = JOB,
    area_id: UUID | None = AREA,
    status: str | None = "draft",
    **kwargs,
) -> Resource:
    return Resource(
        type=type, project_id=project_id, area_id=area_id, status=status, **kwargs
    )


def names(walk) -> list[str]:
    return [step.policy for step in _traces(walk)]


def first_stop(walk) -> EvaluationTrace:
    for step in _traces(walk):
        if step.stopped:
            return step
    raise AssertionError("walk never stopped")


def test_policy_set_rank_is_fixed():
    assert tuple(policy.name for policy in FIELD_POLICY_SET.ranked()) == EXPECTED_ORDER


def test_env_now_is_factory_not_import_stamp():
    from dataclasses import MISSING, dataclass, fields
    from datetime import datetime, timezone

    now_field = next(item for item in fields(Env) if item.name == "now")
    assert now_field.default is MISSING
    assert now_field.default_factory is not MISSING
    assert isinstance(now_field.default_factory(), datetime)
    reject_frozen_env_now(Env)

    @dataclass(frozen=True)
    class FrozenNow:
        now: datetime = datetime.now(timezone.utc)
        on_site: bool = True

    with pytest.raises(TypeError, match="class-body"):
        reject_frozen_env_now(FrozenNow)


def test_subject_crew_ids_is_per_instance_frozenset():
    from dataclasses import MISSING, dataclass, field, fields
    from uuid import UUID

    crew = next(item for item in fields(Subject) if item.name == "crew_ids")
    assert crew.default is MISSING
    assert crew.default_factory is frozenset
    assert Subject.__dataclass_params__.frozen is True
    reject_subject_crew_ids(Subject)

    @dataclass(frozen=True)
    class SharedCrew:
        crew_ids: frozenset[UUID] = frozenset()

    with pytest.raises(TypeError, match="class-body"):
        reject_subject_crew_ids(SharedCrew)

    @dataclass(frozen=True)
    class MutableCrew:
        crew_ids: set[UUID] = field(default_factory=set)

    with pytest.raises(TypeError, match="mutable"):
        reject_subject_crew_ids(MutableCrew)

    @dataclass
    class Thawed:
        crew_ids: frozenset[UUID] = field(default_factory=frozenset)

    with pytest.raises(TypeError, match="frozen"):
        reject_subject_crew_ids(Thawed)


def test_wrong_job_stops_at_same_project(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    ))
    assert names(log) == ["same_project"]
    assert first_stop(log).policy == "same_project"
    assert log.decision.policy == "same_project"
    assert log.decision.allowed is False


def test_grokbot_submit_never_reaches_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    ))
    assert first_stop(log).policy == "grokbot_lane"
    assert log.decision.policy == "grokbot_lane"
    assert "role_allows" not in names(log)


def test_apprentice_submit_stops_at_role(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource()))
    assert names(log) == list(EXPECTED_ORDER[:4])
    assert first_stop(log).policy == "role_allows"
    assert log.decision.policy == "role_allows"


def test_journeyman_draft_allow_walks_full_set(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, resource()))
    assert names(log) == list(EXPECTED_ORDER)
    assert [step.applicable for step in log.traces] == [
        False,
        False,
        False,
        True,
        False,
        False,
        False,
        False,
        False,
        False,
    ]
    assert log.traces[-1].policy == "default_deny"
    assert log.traces[-1].applicable is False
    allows = [step for step in log.traces if step.decision and step.decision.allowed]
    assert len(allows) == 1
    assert allows[0].policy == "role_allows"
    assert log.decision.allowed is True
    assert log.decision.policy == "role_allows"


def test_area_foreman_other_area_stops_after_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    ))
    assert names(log) == list(EXPECTED_ORDER[:5])
    assert first_stop(log).policy == "area_scope"
    assert log.traces[3].policy == "role_allows"
    assert log.traces[3].decision.effect is Effect.ALLOW


def test_gf_skips_area_and_still_walks(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.GENERAL_FOREMAN, area_id=None), Action.SUBMIT_RFI, resource()))
    assert names(log) == list(EXPECTED_ORDER)
    area = next(step for step in log.traces if step.policy == "area_scope")
    assert area.applicable is False
    assert log.decision.allowed is True


def test_foreman_other_crew_stops_at_chain_owns(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    ))
    assert names(log) == list(EXPECTED_ORDER[:7])
    assert first_stop(log).policy == "chain_owns"
    assert log.decision.policy == "chain_owns"


def test_submit_from_answered_stops_at_status(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    ))
    assert names(log) == list(EXPECTED_ORDER[:8])
    assert first_stop(log).policy == "status_guard"
    assert log.decision.policy == "status_guard"


def test_work_stopped_demote_without_flag(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SET_PRIORITY,
        resource(priority="work_stopped", work_stopped=True, status="ball_in_court"),
        ctx={"priority": "standard", "allow_demote": False},
    ))
    assert names(log) == list(EXPECTED_ORDER[:9])
    assert first_stop(log).policy == "work_stop_writer"
    assert log.traces[-1].decision.effect is Effect.DENY
    assert log.decision.policy == "work_stop_writer"
    assert "default_deny" not in names(log)


def test_work_stop_action_always_denied_at_writer(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.GENERAL_FOREMAN), Action.WORK_STOP, resource()))
    assert names(log) == list(EXPECTED_ORDER[:9])
    assert first_stop(log).policy == "work_stop_writer"
    assert first_stop(log).decision.reason == "use set_priority; do not flip work_stopped"
    assert "default_deny" not in names(log)


def test_require_access_raises_with_trace_stop(cov: PolicyCoverage):
    with pytest.raises(AccessDenied) as raised:
        require_access(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    cov.record(raised.value)
    assert raised.value.decision.policy == "role_allows"
    assert first_stop(raised.value).policy == "role_allows"
    assert names(raised.value) == list(EXPECTED_ORDER[:4])


def test_off_site_pin_stops_before_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    ))
    assert names(log) == list(EXPECTED_ORDER[:3])
    assert first_stop(log).policy == "on_site"
    assert "role_allows" not in names(log)


def test_no_later_allow_overrides_earlier_deny(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN, project_id=JOB),
        Action.CREATE_RFI_DRAFT,
        resource(project_id=OTHER_JOB),
    ))
    assert names(log) == ["same_project"]
    assert first_stop(log).policy == "same_project"
    assert "role_allows" not in names(log)
    assert log.decision.allowed is False


def test_journeyman_create_other_area_later_deny_wins(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN, area_id=AREA),
        Action.CREATE_RFI_DRAFT,
        resource(area_id=OTHER_AREA),
    ))
    assert names(log) == list(EXPECTED_ORDER[:5])
    assert first_stop(log).policy == "area_scope"
    assert "assigned_only" not in names(log)
    assert log.traces[3].policy == "role_allows"
    assert log.traces[3].decision.effect is Effect.ALLOW
    assert log.traces[3].decision.reason == "journeyman may create_rfi_draft"
    assert first_stop(log).decision.reason == "outside your area"


def test_apprentice_handle_unassigned_stops_at_assigned_only(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=None),
    ))
    assert names(log) == list(EXPECTED_ORDER[:6])
    assert first_stop(log).policy == "assigned_only"
    assert first_stop(log).decision.reason == "not your ticket"
    assert log.traces[3].policy == "role_allows"
    assert log.traces[3].decision.effect is Effect.ALLOW
    assert log.traces[3].decision.reason == "apprentice may handle_material"


def test_apprentice_handle_other_ticket_stops_at_assigned_only(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER),
    ))
    assert names(log) == list(EXPECTED_ORDER[:6])
    assert first_stop(log).policy == "assigned_only"
    assert first_stop(log).decision.reason == "not your ticket"
    assert "chain_owns" not in names(log)


def test_grokbot_handle_stops_at_lane(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE, actor_type=ActorType.GROKBOT),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    ))
    assert names(log) == list(EXPECTED_ORDER[:2])
    assert first_stop(log).policy == "grokbot_lane"
    assert "role_allows" not in names(log)
    assert "assigned_only" not in names(log)


def test_journeyman_handle_stops_at_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    ))
    assert names(log) == list(EXPECTED_ORDER[:4])
    assert first_stop(log).policy == "role_allows"
    assert first_stop(log).decision.reason == "journeyman cannot handle_material"
    assert "assigned_only" not in names(log)


def test_apprentice_handle_own_ticket_allows(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    ))
    assert names(log) == list(EXPECTED_ORDER)
    assigned = next(step for step in log.traces if step.policy == "assigned_only")
    assert assigned.applicable is False
    assert assigned.decision is None
    assert log.decision.allowed is True
    assert log.decision.policy == "role_allows"
    assert log.decision.reason == "apprentice may handle_material"


def test_default_deny_is_deny_only_when_nothing_permitted():
    from abac import Combining, Policy, PolicySet, default_deny, same_project

    empty = PolicySet(
        name="empty",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="same_project", rule=same_project, order=10),
            Policy(name="default_deny", rule=default_deny, order=99),
        ),
    )
    log = evaluate(
        subject(project_id=JOB),
        Action.VIEW_PRINT,
        resource(project_id=JOB),
        policy_set=empty,
    )
    assert names(log) == ["same_project", "default_deny"]
    assert first_stop(log).policy == "default_deny"
    assert log.decision.allowed is False
    assert default_deny(subject(), Action.VIEW_PRINT, resource(), Env()).effect is Effect.DENY
