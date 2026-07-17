"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={cn(className)}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
