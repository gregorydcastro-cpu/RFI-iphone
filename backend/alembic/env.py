from logging.config import fileConfig
import importlib.util
import os
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# alembic/ is a script dir, not a package. Load hooks.py as alembic.hooks
# so env.py can keep the exact import without shadowing `from alembic import op`.
_HOOKS = Path(__file__).resolve().parent / "hooks.py"
if "alembic.hooks" not in sys.modules:
    _spec = importlib.util.spec_from_file_location("alembic.hooks", _HOOKS)
    _mod = importlib.util.module_from_spec(_spec)
    assert _spec.loader is not None
    sys.modules["alembic.hooks"] = _mod
    _spec.loader.exec_module(_mod)

from alembic.hooks import HookError, MigrateContext, post_migrate, pre_migrate

from app.db import database_url
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", database_url().replace("%", "%%"))
target_metadata = Base.metadata  # or your Base.metadata


def _direction() -> str:
    cmd = context.config.cmd_opts
    if cmd and getattr(cmd, "cmd", None) and cmd.cmd[0].__name__ == "downgrade":
        return "down"
    return "up"


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        on_version_apply=_on_version_apply,
    )
    with context.begin_transaction():
        pre_migrate(
            MigrateContext(None, True, _direction(), None, None)  # type: ignore[arg-type]
        )
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            on_version_apply=_on_version_apply,
        )
        ctx = MigrateContext(
            connection=connection,
            is_offline=False,
            direction=_direction(),
            starting_rev=None,
            target_rev=getattr(context.get_context(), "_destination", None),
        )
        pre_migrate(ctx)
        try:
            with context.begin_transaction():
                context.run_migrations()
            post_migrate(ctx)
        except Exception:
            from alembic.hooks import release_lock

            release_lock(connection)
            raise


def _on_version_apply(ctx, step, heads, run_args) -> None:
    """Fires once per revision. Log only — do not mutate RFI rows."""
    import logging

    logging.getLogger("alembic.hooks").info(
        "applied %s → %s (%s)",
        getattr(step, "down_revision_id", None),
        getattr(step, "up_revision_id", None),
        getattr(step, "destination_name", None),
    )


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
