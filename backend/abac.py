"""Import shim so pytest can `from abac import ...`."""

from app.abac import *  # noqa: F403
from app.abac import FIELD_POLICY_SET, require_access, evaluate
