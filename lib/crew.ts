/**
 * Fictional Maple Point demo crew. Drafts always go to the foreman.
 * Never submit RFIs or POs into Procore.
 */

export const DEMO_JOURNEYMAN = {
  name: "Alex Rivera",
  role: "journeyman",
  email: "alex.rivera@crew.example",
} as const;

export const DEMO_FOREMAN = {
  name: "Pat Nguyen",
  role: "foreman",
  email: "pat.nguyen@crew.example",
} as const;

export function authorFromSessionEmail(email: string | null | undefined): {
  name: string;
  email: string;
  role: string;
} {
  const trimmed = email?.trim().toLowerCase() ?? "";
  if (!trimmed || !trimmed.includes("@")) {
    return {
      name: DEMO_JOURNEYMAN.name,
      email: DEMO_JOURNEYMAN.email,
      role: DEMO_JOURNEYMAN.role,
    };
  }
  if (trimmed === DEMO_JOURNEYMAN.email) {
    return {
      name: DEMO_JOURNEYMAN.name,
      email: trimmed,
      role: DEMO_JOURNEYMAN.role,
    };
  }
  if (trimmed === DEMO_FOREMAN.email) {
    return {
      name: DEMO_FOREMAN.name,
      email: trimmed,
      role: DEMO_FOREMAN.role,
    };
  }
  const local = trimmed.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const name = local
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    name: name || DEMO_JOURNEYMAN.name,
    email: trimmed,
    role: DEMO_JOURNEYMAN.role,
  };
}
