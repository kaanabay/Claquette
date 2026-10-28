"use client";

import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { FieldError } from "@/components/ui/form-message";
import { useFieldId } from "@/components/ui/use-field-id";
import { isChecklist, toggleChecklist } from "../domain";

/** Title and text of a note, shared by "Not ekle" and editing. `body` is controlled for "Liste yap". */
export function NoteFields({
  defaultTitle,
  body,
  onBodyChange,
  errors,
  autoFocus = false,
}: {
  defaultTitle: string;
  body: string;
  onBodyChange: (body: string) => void;
  errors: Record<string, string[] | undefined>;
  autoFocus?: boolean;
}) {
  const fid = useFieldId();
  const checklist = isChecklist(body);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fid("title")}>Başlık (isteğe bağlı)</Label>
        <Input id={fid("title")} name="title" defaultValue={defaultTitle} maxLength={120} placeholder="ör. Yönetmen havuzu" autoFocus={autoFocus} />
        <FieldError errors={errors.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor={fid("body")}>Not</Label>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onBodyChange(toggleChecklist(body))}>
            <ListChecks /> {checklist ? "Listeyi kaldır" : "Liste yap"}
          </Button>
        </div>
        <Textarea
          id={fid("body")}
          name="body"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          rows={Math.min(18, Math.max(4, body.split("\n").length + 1))}
          maxLength={20000}
          placeholder={"Her satıra bir şey yaz; işaretlenebilir liste için satır başına [ ] koy ya da “Liste yap”a bas.\nBağlantılar tıklanır olur."}
        />
        <FieldError errors={errors.body} />
      </div>
    </div>
  );
}
