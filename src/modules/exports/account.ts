import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { boardNotes, challenges, entries, groupMembers, groups, mediaItems, notes, users } from "@/db/schema";
import { listMyLists } from "@/modules/lists/queries";
import { titleColumns } from "@/modules/media/columns";
import { formatTitle } from "@/modules/media/titles";
import type { AccountData, BoardNoteExport } from "./archive";
import type { ExportDoc } from "./document";
import { getChallengeExport, getListExport } from "./queries";

const author = alias(users, "author");

/**
 * Everything that belongs to a user or that they share with their groups: their personal lists,
 * the shared lists and boards of every group they are in, and the notes they wrote.
 */
export async function loadAccountData(userId: string): Promise<AccountData> {
  const [[user], myLists, memberships] = await Promise.all([
    db.select({ name: users.name, username: users.username, email: users.email, joinedAt: users.createdAt }).from(users).where(eq(users.id, userId)),
    listMyLists(userId),
    db
      .select({ id: groups.id, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId))
      .orderBy(asc(groups.name)),
  ]);
  const groupIds = memberships.map((group) => group.id);

  const [personalDocs, sharedLists, boardRows, noteRows] = await Promise.all([
    Promise.all(myLists.map((list) => getListExport(userId, list.id))),
    groupIds.length
      ? db
          .select({ id: challenges.id, groupId: challenges.groupId })
          .from(challenges)
          .where(inArray(challenges.groupId, groupIds))
          .orderBy(asc(challenges.createdAt))
      : [],
    groupIds.length
      ? db
          .select({
            groupId: boardNotes.groupId,
            listTitle: challenges.title,
            title: boardNotes.title,
            body: boardNotes.body,
            author: author.name,
            isPinned: boardNotes.isPinned,
            createdAt: boardNotes.createdAt,
            updatedAt: boardNotes.updatedAt,
          })
          .from(boardNotes)
          .leftJoin(challenges, eq(challenges.id, boardNotes.challengeId))
          .leftJoin(author, eq(author.id, boardNotes.createdBy))
          .where(and(inArray(boardNotes.groupId, groupIds), isNull(boardNotes.deletedAt)))
          .orderBy(desc(boardNotes.isPinned), asc(boardNotes.createdAt))
      : [],
    db
      .select({
        group: groups.name,
        list: challenges.title,
        ...titleColumns,
        visibility: notes.visibility,
        isSpoiler: notes.isSpoiler,
        body: notes.body,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .innerJoin(entries, eq(entries.id, notes.entryId))
      .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
      .innerJoin(challenges, eq(challenges.id, entries.challengeId))
      .innerJoin(groups, eq(groups.id, challenges.groupId))
      .where(eq(notes.authorId, userId))
      .orderBy(asc(notes.createdAt)),
  ]);

  const sharedDocs = await Promise.all(sharedLists.map((list) => getChallengeExport(userId, list.id)));
  const docsByGroup = new Map<string, ExportDoc[]>();
  sharedLists.forEach((list, i) => {
    const doc = sharedDocs[i];
    if (doc) docsByGroup.set(list.groupId, [...(docsByGroup.get(list.groupId) ?? []), doc]);
  });

  return {
    exportedAt: new Date(),
    user: { name: user?.name ?? "", username: user?.username ?? null, email: user?.email ?? "", joinedAt: user?.joinedAt ?? new Date() },
    personalLists: myLists.flatMap((list, i) => {
      const doc = personalDocs[i];
      return doc ? [{ doc, visibility: list.visibility }] : [];
    }),
    groups: memberships.map((group) => {
      const boards = new Map<string, BoardNoteExport[]>();
      for (const { groupId, listTitle, ...note } of boardRows) {
        if (groupId !== group.id) continue;
        const name = listTitle ?? "Grup panosu";
        boards.set(name, [...(boards.get(name) ?? []), note]);
      }
      return {
        name: group.name,
        lists: docsByGroup.get(group.id) ?? [],
        // The group's own board first.
        boards: [...boards].sort(([a], [b]) => Number(b === "Grup panosu") - Number(a === "Grup panosu")).map(([name, list]) => ({ name, notes: list })),
      };
    }),
    notes: noteRows.map((row) => ({
      group: row.group,
      list: row.list,
      item: formatTitle(row),
      visibility: row.visibility,
      isSpoiler: row.isSpoiler,
      body: row.body,
      createdAt: row.createdAt,
    })),
  };
}
