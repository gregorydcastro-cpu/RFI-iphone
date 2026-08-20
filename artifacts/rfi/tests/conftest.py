"""Fixtures for the in-memory package. No coverage JSON. No Postgres."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID

import pytest

from rfi.access import (
    ActorType,
    Resource,
    Role,
    Subject,
    evaluate as _evaluate,
)

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
    return [step.policy for step in walk.steps]


def format_trace(steps) -> str:
    lines: list[str] = []
    for i, step in enumerate(steps, start=1):
        if not step.applicable:
            mark = "n/a"
        elif step.effect == "deny":
            mark = f"DENY  {step.reason}"
        else:
            mark = f"ALLOW {step.reason}"
        stop = "  STOP" if step.stopped else ""
        lines.append(f"{i:2}  {step.policy:<20} {mark}{stop}")
    return "\n".join(lines)


def stop_policy(steps) -> str | None:
    for step in steps:
        if step.stopped:
            return step.policy
    return None


def assert_stop(steps, name: str) -> None:
    actual = stop_policy(steps)
    if actual != name:
        raise AssertionError(
            f"expected stop at {name}, got {actual}\n{format_trace(steps)}"
        )


@pytest.fixture
def cov():
    return SimpleNamespace(evaluate=_evaluate)
