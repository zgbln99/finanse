import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden · Rechnungs-Cockpit" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
