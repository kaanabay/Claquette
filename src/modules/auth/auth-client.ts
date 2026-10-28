import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Sign-in runs from the browser through /api/auth so Better Auth's rate limiting applies.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});
