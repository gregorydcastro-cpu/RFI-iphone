"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.info("[gcfieldlog] stub login — no auth yet", { email });
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
          Stub login. No real auth, Stripe, or Apple sign-in.
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
      <button
        type="submit"
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Enter dashboard
      </button>
    </form>
  );
}
