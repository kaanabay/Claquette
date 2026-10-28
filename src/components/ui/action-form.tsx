"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { FormMessage } from "./form-message";
import { FreshAfterSubmit } from "./fresh-after-submit";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

type ActionFormProps = {
  action: Action;
  children: ReactNode;
  className?: string;
  messageClassName?: string;
};

/**
 * A <form> bound to a Server Action that shows the returned error/success message.
 * Server Components pass the action and plain inputs/buttons as children.
 */
export function ActionForm(props: ActionFormProps) {
  return (
    <FreshAfterSubmit>
      <ActionFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function ActionFormInner({ action, children, className, messageClassName }: ActionFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={cn("contents", className)}>
      {children}
      <FormMessage state={state} className={messageClassName} />
    </form>
  );
}
