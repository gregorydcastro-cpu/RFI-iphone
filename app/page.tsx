import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <LoginForm />
      </main>
    </div>
  );
}
