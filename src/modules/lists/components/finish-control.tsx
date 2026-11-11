"use client";

import { Check, Circle } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/fields";
import { highlight } from "@/components/ui/highlight";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import { useFieldId } from "@/components/ui/use-field-id";
import { formatShortDate, toDayValue } from "@/lib/short-date";
import { cn } from "@/lib/utils";
import { progressLabel } from "@/modules/entries/labels";
import { MediaTitle } from "@/modules/media/components/media-title";
import { finishListItemAction, undoFinishAction, unfinishAction } from "../actions";
import { finishDefaults } from "../finishes";
import type { ListPageData } from "../queries";
import type { FinishUndo } from "../service";

type Item = ListPageData["items"][number];

const pill = "h-7 w-fit max-w-full px-2.5";

/**
 * "İzledim" on the owner's row. It opens a dialog that asks the day and whether the item leaves the
 * list; the list may remember that choice, but nothing happens before "Kaydet". A marked item shows its
 * day and opens the same dialog to change it or take the mark off. One finished in a shared list links
 * there (its progress is kept in that list).
 */
export function FinishControl({ item, remembered }: { item: Item; remembered: boolean | null }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const label = progressLabel("completed", item.media.mediaType);
  const finish = item.finish;

  if (finish && !finish.marked && finish.entryId) {
    return (
      <Link
        href={`/entries/${finish.entryId}`}
        title={`“${finish.challengeTitle}” listesinde bitirdin`}
        className={cn(buttonVariants({ size: "sm" }), pill)}
      >
        <Check /> <span className="min-w-0 truncate">{`${label} · ${finish.challengeTitle}`}</span>
      </Link>
    );
  }
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={finish ? "default" : "outline"}
        aria-pressed={finish !== null}
        onClick={() => setOpen(true)}
        title={finish ? "Günü değiştir ya da işareti kaldır" : undefined}
        className={pill}
      >
        {finish ? <Check /> : <Circle />} {finish ? `${label} · ${formatShortDate(finish.finishedAt)}` : label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <FinishForm item={item} label={label} remembered={remembered} headingId={headingId} close={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function FinishForm({
  item,
  label,
  remembered,
  headingId,
  close,
}: {
  item: Item;
  label: string;
  remembered: boolean | null;
  headingId: string;
  close: () => void;
}) {
  const fid = useFieldId();
  const defaults = finishDefaults(remembered);
  const marked = item.finish?.marked === true;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function offerUndo(message: string, undo: FinishUndo) {
    toast(message, {
      action: {
        label: "Geri al",
        onClick: async () => {
          const undone = await undoFinishAction(undo);
          if (undone?.error) toast(undone.error, { isError: true });
          else if (undo.removed) highlight([undo.removed.id]);
        },
      },
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const choice = { itemId: item.id, day: String(data.get("day") ?? ""), remove: data.get("remove") === "on", remember: data.get("remember") === "on" };
    setError(null);
    startTransition(async () => {
      const result = await finishListItemAction(choice);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      close();
      offerUndo(result.notice, result.undo);
    });
  }

  function unmark() {
    setError(null);
    startTransition(async () => {
      const result = await unfinishAction(item.media.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      close();
      offerUndo(`“${result.title}” için “${label}” işaretin kaldırıldı.`, result.undo);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg font-semibold leading-snug wrap-anywhere">
          <MediaTitle media={item.media} />
        </h2>
        <p className="text-sm text-muted-foreground">
          {marked ? `“${label}” olarak işaretli. Günü değiştirebilir ya da işareti kaldırabilirsin.` : `“${label}” olarak işaretle. Profilinde, bitirdiklerinin arasında görünür.`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("day")}>Ne zaman?</Label>
        <Input
          id={fid("day")}
          type="date"
          name="day"
          required
          defaultValue={toDayValue(item.finish?.finishedAt ?? new Date())}
          max={toDayValue(new Date())}
          className="w-auto"
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox name="remove" defaultChecked={defaults.remove} className="mt-0.5" />
        <span>
          <span className="block font-medium">Listeden çıkar</span>
          <span className="block text-xs text-muted-foreground">İşaretin profilinde kalır; öge yalnız bu listeden çıkar.</span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox name="remember" defaultChecked={defaults.remember} className="mt-0.5" />
        <span>
          <span className="block font-medium">Bu liste için seçimimi hatırla</span>
          <span className="block text-xs text-muted-foreground">“Listeden çıkar” bu listede bir dahaki sefere de böyle gelir.</span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {marked ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={unmark} className="mr-auto text-destructive">
            İşareti kaldır
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={close}>
          Vazgeç
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          <Check /> Kaydet
        </Button>
      </div>
    </form>
  );
}
