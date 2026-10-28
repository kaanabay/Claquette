"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Cache Components keeps up to three visited routes alive (hidden) with React <Activity>.
 * Without this, a submitted form would come back with its old values, stale messages, or
 * even the typed password. Children are remounted once they are hidden after a submit;
 * an untouched draft is still preserved when the user navigates away and back.
 */
export function FreshAfterSubmit({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  const submitted = useRef(false);

  // Layout-effect cleanups run when Activity hides the route.
  useLayoutEffect(
    () => () => {
      if (submitted.current) {
        submitted.current = false;
        setGeneration((value) => value + 1);
      }
    },
    [],
  );

  return (
    <div
      className="contents"
      onSubmitCapture={() => {
        submitted.current = true;
      }}
    >
      <Fragment key={generation}>{children}</Fragment>
    </div>
  );
}
