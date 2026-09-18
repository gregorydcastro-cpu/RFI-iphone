"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { procoreLinkedCookie } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [procoreLinked, setProcoreLinked] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.cookie = procoreLinkedCookie(procoreLinked);
    console.info("[gcfieldlog] stub login — no auth yet", {
      email,
      procoreLinked,
    });
    router.push("/jobs");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md space-y-4 border border-line bg-panel p-6 shadow-[0_0_0_1px_rgb(225_6_0_/_0.15)]"
    >
      <div>
        <h1 className="font-display text-3xl tracking-wide text-secondary">
          GC Field Log
        </h1>
        <p className="mt-2 text-sm text-accent-2">
          Stub login. No real auth, Stripe, or Apple sign-in. Default is view
          only; check Procore linked to pull packs.
        </p>
      </div>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Email
        <input
          required
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="foreman@crew.example"
        />
      </label>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Password
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="••••••••"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-paper">
        <input
          type="checkbox"
          checked={procoreLinked}
          onChange={(event) => setProcoreLinked(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Linked Procore account (puller)</span>
          <span className="mt-0.5 block text-xs text-muted">
            Sets <code className="font-mono">procoreLinked=true</code> on this
            session. Leave unchecked for read-only.
          </span>
        </span>
      </label>
      <button
        type="submit"
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Enter dashboard
      </button>
    </form>
  );
}
