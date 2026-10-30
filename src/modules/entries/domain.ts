// Pure rules about entries (no I/O), shared by the service and the pages.

/**
 * Who may delete an entry added by mistake: whoever added it, the list's creator and group
 * admins (`canManage`). Others can still drop it through the workflow.
 */
export function canDeleteEntry(input: { actorId: string; suggestedBy: string | null; canManage: boolean }): boolean {
  return input.canManage || (input.suggestedBy !== null && input.actorId === input.suggestedBy);
}

/** A finish moved to the day it really happened: a start recorded after that day moves back with it. */
export function finishOnDay(progress: { startedAt: Date | null }, day: Date): { startedAt: Date; completedAt: Date } {
  return { startedAt: progress.startedAt && progress.startedAt < day ? progress.startedAt : day, completedAt: day };
}
