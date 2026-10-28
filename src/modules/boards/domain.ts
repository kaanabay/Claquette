// Board notes are plain text with a little structure read out of it (pure, no I/O): checklist
// lines, links. Lists pasted from Google Keep or written by hand both work.

export type NoteLine = { kind: "text"; text: string } | { kind: "check"; text: string; checked: boolean };

// "[ ] Bergman", "- [x] Varda", "* [ ] …"
const BRACKETS = /^\s*(?:[-*]\s+)?\[( |x|X)\]\s?(.*)$/;
// "☐ Bergman", "☑ Varda", "✓ …" (what other apps paste)
const BOXES = /^\s*([☐☑☒✓✔✅])\s?(.*)$/u;

export function parseLine(line: string): NoteLine {
  const brackets = line.match(BRACKETS);
  if (brackets) return { kind: "check", checked: brackets[1] !== " ", text: brackets[2] };
  const box = line.match(BOXES);
  if (box) return { kind: "check", checked: box[1] !== "☐", text: box[2] };
  return { kind: "text", text: line };
}

export const parseNote = (body: string): NoteLine[] => body.split(/\r?\n/).map(parseLine);

const formatLine = (line: NoteLine) => (line.kind === "check" ? `[${line.checked ? "x" : " "}] ${line.text}` : line.text);

/**
 * Ticks or unticks line `index`. Returns null when that line is no longer the checklist line with
 * this text (someone edited the note meanwhile), so a stale click never ticks the wrong line.
 */
export function setLineChecked(body: string, index: number, text: string, checked: boolean): string | null {
  const lines = body.split(/\r?\n/);
  if (index < 0 || index >= lines.length) return null;
  const line = parseLine(lines[index]);
  if (line.kind !== "check" || line.text !== text) return null;
  lines[index] = formatLine({ ...line, checked });
  return lines.join("\n");
}

/** Whether every non-empty line is a checklist line. */
export function isChecklist(body: string): boolean {
  const filled = parseNote(body).filter((line) => line.text.trim());
  return filled.length > 0 && filled.every((line) => line.kind === "check");
}

/**
 * "Liste yap": every non-empty line becomes a checklist line (ticks already there stay); on a note
 * that is all checklist, "Listeyi kaldır" turns it back into plain lines.
 */
export function toggleChecklist(body: string): string {
  const lines = parseNote(body);
  if (isChecklist(body)) return lines.map((line) => line.text).join("\n");
  return lines
    .map((line) =>
      line.kind === "check" ? formatLine(line) : line.text.trim() ? formatLine({ kind: "check", checked: false, text: line.text.trim() }) : "",
    )
    .join("\n");
}

export function checklistCounts(lines: readonly NoteLine[]): { done: number; total: number } {
  const checks = lines.filter((line) => line.kind === "check");
  return { done: checks.filter((line) => line.checked).length, total: checks.length };
}

const URL_PATTERN = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'’]/g;

/** Splits text into plain parts and web links (trailing punctuation stays out of the link). */
export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], href: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/**
 * Who may delete a note: whoever wrote it, plus those who manage the board (the list's creator or
 * a group admin). Anyone in the group may edit, tick and pin: a board is shared on purpose.
 */
export function canDeleteNote(input: { actorId: string; createdBy: string | null; canManage: boolean }): boolean {
  return input.canManage || (input.createdBy !== null && input.actorId === input.createdBy);
}

/** How long a deleted note can be brought back. */
export const RESTORE_WINDOW_MS = 10 * 60 * 1000;
