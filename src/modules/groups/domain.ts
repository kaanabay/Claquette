// Pure group rules (no I/O).

export type MemberRole = "owner" | "admin" | "member";

/**
 * Who may change a member's role or remove them from the group: group admins (the site admin
 * counts as one), never on the group's owner and never on themselves.
 */
export function canManageMember(input: { actorId: string; actorIsAdmin: boolean; targetId: string; targetRole: MemberRole }): boolean {
  return input.actorIsAdmin && input.actorId !== input.targetId && input.targetRole !== "owner";
}
