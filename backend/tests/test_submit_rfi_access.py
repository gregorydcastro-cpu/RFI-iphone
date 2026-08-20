"""Handler tests. Real require_access. No coverage bag."""

from __future__ import annotations

import inspect

import pytest

from abac import AccessDenied, Action, HUNG_WRITES, Role, require_access
from tests.conftest import resource, subject

evaluate = None


def test_submit_rfi_require_access_policy_only():
    with pytest.raises(AccessDenied) as raised:
        require_access(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    assert raised.value.decision.policy == "role_allows"


def test_three_writes_hang_require_access():
    from app import main

    assert HUNG_WRITES == frozenset(
        {"create_rfi_draft", "submit_rfi", "set_priority"}
    )
    sources = (
        inspect.getsource(main.create_rfi_draft),
        inspect.getsource(main.pe_submit_rfi),
        inspect.getsource(main.pe_set_priority),
    )
    for src in sources:
        assert "require_access(" in src
        assert src.index("require_access(") < src.index("except AccessDenied")
