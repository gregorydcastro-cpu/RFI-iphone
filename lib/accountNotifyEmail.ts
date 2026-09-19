/**
 * Account settings glue for `procore_connections.notify_email`.
 *
 * Parse/persist live in Repo Eng helpers (`parseNotifyEmailInput`,
 * `upsertNotifyEmail`). This file only gates the puller session and
 * adds a process-memory fallback for the local Maple Point demo.
 */

import { parseNotifyEmailInput } from "./notifyEmail";
import {
  fetchNotifyEmailForUser,
  upsertNotifyEmail,
} from "./notifyEmailStore";
import { getSupabaseServiceConfig } from "./procoreConnections";

export type NotifyEmailStorage = "supabase" | "memory";

export { canManageNotifyEmail } from "./accountRole";

const g = globalThis as typeof globalThis & {
  __gcFieldLogNotifyEmail?: Map<string, string | null>;
};

export function accountNotifyEmailMemory(): Map<string, string | null> {
  if (!g.__gcFieldLogNotifyEmail) {
    g.__gcFieldLogNotifyEmail = new Map();
  }
  return g.__gcFieldLogNotifyEmail;
}

export async function loadAccountNotifyEmail(userId: string): Promise<{
  notify_email: string | null;
  storage: NotifyEmailStorage;
}> {
  if (!getSupabaseServiceConfig()) {
    return {
      notify_email: accountNotifyEmailMemory().get(userId) ?? null,
      storage: "memory",
    };
  }
  return {
    notify_email: await fetchNotifyEmailForUser(userId),
    storage: "supabase",
  };
}

export async function saveAccountNotifyEmail(
  userId: string,
  value: unknown,
): Promise<
  | { ok: true; notify_email: string | null; storage: NotifyEmailStorage }
  | { ok: false; error: string; status: number }
> {
  if (value !== null && value !== undefined && typeof value !== "string") {
    return { ok: false, error: "Enter a valid notify email.", status: 400 };
  }
  const parsed = parseNotifyEmailInput(value ?? null);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  if (!getSupabaseServiceConfig()) {
    accountNotifyEmailMemory().set(userId, parsed.notify_email);
    return {
      ok: true,
      notify_email: parsed.notify_email,
      storage: "memory",
    };
  }

  const saved = await upsertNotifyEmail(userId, parsed.notify_email);
  if (!saved.ok) {
    return { ok: false, error: saved.error, status: saved.status };
  }
  return {
    ok: true,
    notify_email: saved.notify_email,
    storage: "supabase",
  };
}
