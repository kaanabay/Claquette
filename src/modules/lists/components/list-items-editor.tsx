"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, ExternalLink, GripVertical, MoreHorizontal, NotebookPen, Send, Trash } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/fields";
import { FormMessage } from "@/components/ui/form-message";
import { highlight } from "@/components/ui/highlight";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/lib/action-state";
import { formatShortDate, toDayValue } from "@/lib/short-date";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import type { SortKey } from "@/modules/media/sort";
import {
  removeListItemAction,
  reorderListItemsAction,
  restoreListItemAction,
  updateListItemDateAction,
  updateListItemNoteAction,
} from "../actions";
import type { ListPageData } from "../queries";

type Item = ListPageData["items"][number];
type ShareTarget = ListPageData["shareTargets"][number];

/**
 * The owner's view of a list: drag the handle (or focus it and use the arrow keys) to reorder,
 * add a note, remove an item, or suggest it to a shared list. The new order is saved at once.
 */
export function ListItemsEditor({
  listId,
  isRanked,
  sort,
  items,
  shareTargets,
}: {
  listId: string;
  isRanked: boolean;
  /** Dragging (and rank numbers) only make sense in the list's manual order. */
  sort: SortKey;
  items: Item[];
  shareTargets: ShareTarget[];
}) {
  const manual = sort === "manual";
  const dndId = useId();
  const serverOrder = items.map((item) => item.id);
  const [order, setOrder] = useState(serverOrder);
  const [syncedWith, setSyncedWith] = useState(serverOrder.join());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Items were added or removed on the server: start again from its order.
  if (serverOrder.join() !== syncedWith) {
    setSyncedWith(serverOrder.join());
    setOrder(serverOrder);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = order;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderListItemsAction(listId, next);
      if (result?.error) {
        setOrder(previous);
        setError(result.error);
      }
    });
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {order.map((id, index) => {
              const item = byId.get(id);
              return item ? (
                <SortableRow key={id} item={item} rank={isRanked && manual ? index + 1 : null} draggable={manual} shareTargets={shareTargets} />
              ) : null;
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  item,
  rank,
  draggable,
  shareTargets,
}: {
  item: Item;
  rank: number | null;
  draggable: boolean;
  shareTargets: ShareTarget[];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !draggable,
  });
  const meta = [item.media.year, item.media.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · ");

  return (
    <li
      ref={setNodeRef}
      id={`item-${item.id}`}
      data-highlight-id={item.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex scroll-mt-24 items-start gap-2 rounded-xl border bg-card p-2.5 shadow-xs target:ring-2 target:ring-primary sm:gap-3 sm:p-3",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/40",
      )}
    >
      {draggable ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`“${formatTitle(item.media)}” ögesinin yerini değiştir`}
          className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
      {rank !== null ? (
        <span className="w-6 shrink-0 pt-2 text-right text-lg font-semibold tabular-nums text-muted-foreground">{rank}</span>
      ) : null}
      <MediaCover src={item.media.imageUrl} title={formatTitle(item.media)} icon={item.type.icon} className="w-12 sm:w-14" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium leading-snug">
          <MediaTitle media={item.media} />
        </p>
        {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
        <DateEditor itemId={item.id} addedAt={item.addedAt} />
        <NoteEditor itemId={item.id} note={item.note} />
      </div>
      <div className="flex shrink-0 items-start">
        <RemoveButton item={item} />
        <ItemMenu item={item} shareTargets={shareTargets} />
      </div>
    </li>
  );
}

/** The item's date (when it was added, or watched, for a diary); the owner can move it to another day. */
function DateEditor({ itemId, addedAt }: { itemId: string; addedAt: Date }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateListItemDateAction(previous, formData);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Tarihi değiştir"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <CalendarDays className="size-3" /> {formatShortDate(addedAt)}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <Input type="date" name="day" defaultValue={toDayValue(addedAt)} max={toDayValue(new Date())} required aria-label="Tarih" className="h-8 w-auto" />
      <SubmitButton size="sm">Kaydet</SubmitButton>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Vazgeç
      </Button>
      <FormMessage state={state} className="text-xs" />
    </form>
  );
}

function NoteEditor({ itemId, note }: { itemId: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateListItemNoteAction(previous, formData);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);

  if (!editing) {
    return (
      <div className="flex flex-col items-start gap-1">
        {note ? <p className="whitespace-pre-wrap text-sm italic text-muted-foreground">“{note}”</p> : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <NotebookPen className="size-3" /> {note ? "Notu düzenle" : "Not ekle"}
        </button>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <Textarea name="note" defaultValue={note ?? ""} rows={2} maxLength={500} placeholder="ör. Neden bu sırada?" className="min-h-16" autoFocus />
      <div className="flex gap-2">
        <SubmitButton size="sm">Kaydet</SubmitButton>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Vazgeç
        </Button>
      </div>
      <FormMessage state={state} className="text-xs" />
    </form>
  );
}

/** Removes at once; the notice that follows offers "Geri al" (with the note and the position). */
function RemoveButton({ item }: { item: Item }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeListItemAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast(`“${result.title}” listeden çıkarıldı.`, {
        action: {
          label: "Geri al",
          onClick: async () => {
            const restored = await restoreListItemAction(result.removed);
            if (restored?.error) toast(restored.error, { isError: true });
            else highlight([result.removed.id]);
          },
        },
      });
    });
  }

  return (
    <div className="flex max-w-40 flex-col items-end">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={remove}
        aria-label={`“${formatTitle(item.media)}” ögesini listeden çıkar`}
        title="Listeden çıkar"
      >
        <Trash className="size-4" />
      </Button>
      {error ? (
        <p role="alert" className="text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ItemMenu({ item, shareTargets }: { item: Item; shareTargets: ShareTarget[] }) {
  const targets = shareTargets.filter(
    (target) => target.mediaTypes.length === 0 || target.mediaTypes.includes(item.media.mediaType),
  );
  if (targets.length === 0 && !item.media.externalUrl) return null;
  return (
    <details className="relative shrink-0">
      <summary
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label={`“${formatTitle(item.media)}” için seçenekler`}
      >
        <MoreHorizontal className="size-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-1 rounded-xl border bg-card p-2 text-sm shadow-lg">
        {targets.length > 0 ? (
          <>
            <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">Ortak listeye öner</p>
            {targets.map((target) => (
              <Link
                key={target.id}
                href={`/challenges/${target.id}?add=1&media=${item.media.id}&mode=suggest`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <Send className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate">{target.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{target.groupName}</span>
                </span>
              </Link>
            ))}
            {item.media.externalUrl ? <hr className="my-1" /> : null}
          </>
        ) : null}
        {item.media.externalUrl ? (
          <a
            href={item.media.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" /> Kaynakta aç
          </a>
        ) : null}
      </div>
    </details>
  );
}
