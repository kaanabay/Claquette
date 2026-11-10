// Notifications (pure, no I/O): the activity log seen from one person. What others did in the groups
// and lists they take part in becomes a notification, except bookkeeping nobody needs to hear about.
// The viewer's own actions never notify them.

import { describeActivity } from "@/modules/activity/describe";

// Housekeeping that would only be noise: settings, steps of a workflow, roles.
const QUIET = new Set(["group.created", "group.updated", "challenge.updated", "member.role_changed", "workflow.created"]);

/**
 * Whether an activity is worth a notification to `viewerId`. Personal progress counts when someone
 * finished, gave up or passed on something, or rated it; "Sırada" and "İzliyorum" would only be
 * chatter. What the app did because of the viewer's own change (`data.by`) is no news to them.
 */
export function isNotifiable(type: string, data: Record<string, unknown>, viewerId?: string): boolean {
  if (QUIET.has(type)) return false;
  if (viewerId && data.by === viewerId) return false;
  if (type === "progress.updated") {
    if (data.status === "completed" || data.status === "dropped" || data.status === "skipped") return true;
    return !data.status && typeof data.rating === "number";
  }
  return true;
}

/**
 * The sentence of a notification and who it is about: "Ayşe “Dune” ögesini bitirdi". A suggestion
 * meant for the viewer speaks to them ("sana “Inception” önerdi").
 */
export function describeNotification(input: {
  type: string;
  data: Record<string, unknown>;
  actorName: string | null;
  /** The item the activity is about is a suggestion for the viewer. */
  forViewer: boolean;
}): { actor: string | null; text: string } {
  const actor = input.actorName ? input.actorName.split(" ")[0] : null;
  if (input.type === "entry.suggested" && input.forViewer && typeof input.data.title === "string") {
    return { actor, text: `sana “${input.data.title}” önerdi` };
  }
  const text = describeActivity(input.type, input.data, actor !== null);
  return { actor, text: actor ? text : text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1) };
}

/** Where a notification leads: the item, else its list, else its group. */
export function notificationHref(input: { entryId: string | null; challengeId: string | null; groupId: string }): string {
  if (input.entryId) return `/entries/${input.entryId}`;
  if (input.challengeId) return `/challenges/${input.challengeId}`;
  return `/groups/${input.groupId}`;
}

/** The bell's badge: the count, "9+" beyond nine. */
export const badgeLabel = (unread: number) => (unread > 9 ? "9+" : String(unread));
