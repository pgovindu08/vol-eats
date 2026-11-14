"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input, a11y } from "@/components/ui/field";
import { api } from "@/lib/api";
import { ALLOWED_EMAIL_DOMAINS, APP_NAME, APP_TAGLINE } from "@/lib/config";
import { getSession, setSession } from "@/lib/session";
import { DEMO_EMAIL } from "@/mock/demo-profile";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email")
    .refine((e) => ALLOWED_EMAIL_DOMAINS.some((d) => e.endsWith(`@${d}`)), "Use your @vols.utk.edu or @utk.edu email"),
});
type LoginForm = z.infer<typeof loginSchema>;

// TODO(auth): mocked. Real UTK sign-in replaces setSession + this page's submit.
export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<"email" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  // Already signed in → skip login.
  useEffect(() => {
    if (getSession()) router.replace("/today");
  }, [router]);

  async function enter(email: string, isDemo: boolean) {
    setBusy(isDemo ? "demo" : "email");
    setError(null);
    setSession({ email, isDemo });
    try {
      const profile = await api.getProfile();
      router.replace(profile ? "/today" : "/onboarding");
    } catch {
      setSession(null);
      setError("Couldn't sign in right now. Check your connection and try again.");
      setBusy(null);
    }
  }

  const emailError = formState.errors.email?.message;

  return (
    <main className="mx-auto flex min-h-dvh max-w-(--content-max) flex-col px-4 pb-8 pt-16">
      <div className="flex-1">
        <LogoMark size={64} />
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">{APP_NAME}</h1>
        <p className="mt-2 text-muted">{APP_TAGLINE}</p>
      </div>

      <form onSubmit={handleSubmit((v) => enter(v.email, false))} noValidate className="space-y-4">
        <Field id="email" label="UTK email" error={emailError}>
          <Input
            {...a11y("email", emailError)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="netid@vols.utk.edu"
            {...register("email")}
          />
        </Field>
        <Button type="submit" size="lg" block disabled={busy !== null}>
          {busy === "email" ? "Signing in…" : "Continue with UTK email"}
        </Button>
        <Button variant="secondary" size="lg" block disabled={busy !== null} onClick={() => enter(DEMO_EMAIL, true)}>
          {busy === "demo" ? "Loading demo…" : "Use demo account"}
        </Button>
        {error ? (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
