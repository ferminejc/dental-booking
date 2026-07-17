"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { login, type LoginState } from "@/lib/auth-actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction] = useActionState(login, initialState);
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const formError = state.status === "error" ? state.message : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          required
          autoComplete="username"
          className="h-12 text-base"
          aria-invalid={!!fieldErrors.username}
        />
        {fieldErrors.username?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 text-base"
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      <SubmitButton label="Sign in" pendingLabel="Signing in..." className="h-12 w-full text-base" />
    </form>
  );
}
