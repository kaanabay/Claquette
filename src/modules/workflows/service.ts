import "server-only";
import { db } from "@/db";
import { workflowStates, workflows } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { logActivity } from "@/modules/activity/service";
import { requireMembership } from "@/modules/groups/service";
import { stateKeys, type StateCategory } from "./domain";

export type WorkflowStepInput = { label: string; category: StateCategory; color: string };

export async function createWorkflow(
  userId: string,
  groupId: string,
  input: { name: string; description: string | null; steps: WorkflowStepInput[] },
): Promise<string> {
  await requireMembership(groupId, userId);
  if (!input.steps.some((step) => step.category === "pending" || step.category === "active")) {
    throw new AppError("Akışta en az bir 'Karar bekliyor' ya da 'Sürüyor' adımı olmalı.");
  }
  if (!input.steps.some((step) => step.category === "done")) {
    throw new AppError("Akışta en az bir 'Tamamlandı' türünde adım olmalı.");
  }
  const keys = stateKeys(input.steps.map((step) => step.label));

  return db.transaction(async (tx) => {
    const [workflow] = await tx
      .insert(workflows)
      .values({ groupId, name: input.name, description: input.description })
      .returning({ id: workflows.id });
    await tx.insert(workflowStates).values(
      input.steps.map((step, index) => ({
        workflowId: workflow.id,
        key: keys[index],
        label: step.label,
        category: step.category,
        color: step.color,
        position: index + 1,
      })),
    );
    await logActivity(tx, {
      groupId,
      actorId: userId,
      type: "workflow.created",
      data: { name: input.name },
    });
    return workflow.id;
  });
}
