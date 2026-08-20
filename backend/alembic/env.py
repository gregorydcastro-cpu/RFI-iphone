"""Alembic runner. Version table is the apply-once lock. pre_migrate first."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
import alembic.context as alembic_context

from app.db import database_url, make_engine
from app.models import Base
from app.pre_migrate import MigrateCtx, pre_migrate

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _env():
    return alembic_context._proxy


def _target_rev():
    env = _env()
    try:
        dest = env.get_revision_argument()
    except Exception:
        dest = env.context_opts.get("destination_rev")
    if isinstance(dest, tuple):
        if len(dest) == 1:
            return dest[0]
        return ",".join(str(part) for part in dest)
    return dest


def _direction() -> str:
    fn = _env().context_opts.get("fn")
    if getattr(fn, "__name__", "") == "downgrade":
        return "down"
    return "up"


def run_migrations_offline() -> None:
    url = database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = make_engine()
    try:
        with connectable.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)
            pre_migrate(
                MigrateCtx(
                    connection=connection,
                    target_rev=_target_rev(),
                    direction=_direction(),
                )
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
