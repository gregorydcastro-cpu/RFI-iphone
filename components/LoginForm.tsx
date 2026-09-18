import type { FieldRoleName } from "@/lib/auth";

type Props = {
  next: string;
  error: string | null;
  defaultRole?: FieldRoleName;
};

/** Server-rendered native form so the POST is a document request (Set-Cookie). */
export function LoginForm({ next, error, defaultRole = "viewer" }: Props) {
  return (
    <form
      method="post"
      action="/api/session"
      target="_self"
      encType="application/x-www-form-urlencoded"
      className="w-full max-w-md space-y-4 border border-line bg-panel p-6 shadow-[0_0_0_1px_rgb(225_6_0_/_0.15)]"
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <h1 className="font-display text-3xl tracking-wide text-secondary">
          GC Field Log
        </h1>
        <p className="mt-2 text-sm text-accent-2">
          Stub login. No real auth or Apple sign-in. Viewers open packs
          without Procore. Pullers connect their own Procore account to
          pull. Monthly billing is a 60-day Stripe Checkout trial on{" "}
          <a href="/pricing" className="text-accent underline">
            /pricing
          </a>
          .
        </p>
      </div>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Email
        <input
          required
          type="email"
          name="email"
          autoComplete="username"
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="foreman@crew.example"
        />
      </label>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Password
        <input
          required
          type="password"
          name="password"
          autoComplete="current-password"
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="••••••••"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
          Role
        </legend>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="role"
            value="viewer"
            defaultChecked={defaultRole === "viewer"}
            className="mt-1"
          />
          <span>
            <span className="font-medium">View only</span>
            <span className="mt-0.5 block text-xs text-muted">
              Open packs. No Procore connect required. Cannot trigger a pull.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="role"
            value="puller"
            defaultChecked={defaultRole === "puller"}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Puller</span>
            <span className="mt-0.5 block text-xs text-muted">
              Must Connect Procore with your own credentials. No developer
              portal signup.
            </span>
          </span>
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Enter dashboard
      </button>
    </form>
  );
}
