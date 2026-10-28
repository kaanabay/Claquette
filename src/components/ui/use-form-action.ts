"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * useActionState for longer forms. React resets uncontrolled fields after every form-action
 * submission, which would wipe the form when the server returns validation errors; dispatching
 * from onSubmit keeps what the user typed. `action` stays set for no-JS submissions.
 */
export function useFormAction(action: Action) {
  const [state, formAction, pending] = useActionState(action, undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return { state, pending, formProps: { action: formAction, onSubmit } };
}
