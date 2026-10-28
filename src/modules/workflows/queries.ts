import "server-only";
import { asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, type Executor } from "@/db";
import { challenges, workflowStates, workflows } from "@/db/schema";
import type { WorkflowState } from "./domain";

const stateColumns = {
  id: workflowStates.id,
  key: workflowStates.key,
  label: workflowStates.label,
  category: workflowStates.category,
  color: workflowStates.color,
  position: workflowStates.position,
};

export async function getWorkflowStates(workflowId: string, executor: Executor = db): Promise<WorkflowState[]> {
  return executor
    .select(stateColumns)
    .from(workflowStates)
    .where(eq(workflowStates.workflowId, workflowId))
    .orderBy(asc(workflowStates.position));
}

export async function getChallengeStates(challengeId: string, executor: Executor = db): Promise<WorkflowState[]> {
  return executor
    .select(stateColumns)
    .from(workflowStates)
    .innerJoin(challenges, eq(challenges.workflowId, workflowStates.workflowId))
    .where(eq(challenges.id, challengeId))
    .orderBy(asc(workflowStates.position));
}

/** System templates plus the group's own workflows. */
export async function listWorkflowsForGroup(groupId: string) {
  return db
    .select({ id: workflows.id, key: workflows.key, name: workflows.name, description: workflows.description })
    .from(workflows)
    .where(or(isNull(workflows.groupId), eq(workflows.groupId, groupId)))
    .orderBy(asc(workflows.createdAt));
}

/** Same list with each workflow's ordered states (for the group page). */
export async function listWorkflowsWithStates(groupId: string) {
  const list = await listWorkflowsForGroup(groupId);
  if (list.length === 0) return [];
  const states = await db
    .select({ workflowId: workflowStates.workflowId, ...stateColumns })
    .from(workflowStates)
    .where(inArray(workflowStates.workflowId, list.map((workflow) => workflow.id)))
    .orderBy(asc(workflowStates.position));
  return list.map((workflow) => ({ ...workflow, states: states.filter((state) => state.workflowId === workflow.id) }));
}

export async function getDefaultWorkflowId(executor: Executor = db): Promise<string> {
  const [row] = await executor.select({ id: workflows.id }).from(workflows).where(eq(workflows.key, "default")).limit(1);
  if (!row) throw new Error("Default workflow is missing. Run `npm run db:migrate`.");
  return row.id;
}
