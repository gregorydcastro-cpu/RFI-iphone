import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/LoginForm";
import { safeNextPath } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const query = await searchParams;
  const error =
    query.error === "session" ? "Could not start a session" : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <LoginForm next={safeNextPath(query.next)} error={error} />
      </main>
    </div>
  );
}
