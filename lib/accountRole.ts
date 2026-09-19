/** Stub Puller / GC / foreman can edit revision-bump notify email. */
export function canManageNotifyEmail(role: string | null | undefined): boolean {
  return role === "puller";
}
