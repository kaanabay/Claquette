"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/**
 * Submit button with a pending state. In forms with several named buttons
 * (e.g. one per workflow state) only the clicked one shows the spinner.
 * Pass `pending` when the form is dispatched manually (see useFormAction).
 */
export function SubmitButton({
  children,
  disabled,
  name,
  value,
  pending: pendingOverride,
  ...props
}: Omit<ButtonProps, "type"> & { pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  const isMine = pending && (pendingOverride !== undefined || !name || status.data?.get(name) === String(value));
  return (
    <Button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={isMine} {...props}>
      {isMine ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
