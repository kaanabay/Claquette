import { seasonLabel, splitTitle, type Titled } from "../titles";

/** "Stalker (İz Sürücü)" with the Turkish part quieter, plus " · 2. Sezon" for a season. Server or client. */
export function MediaTitle({ media }: { media: Titled }) {
  const { lead, local } = splitTitle(media);
  return (
    <>
      {lead}
      {local ? <span className="font-normal text-muted-foreground"> ({local})</span> : null}
      {media.seasonNumber ? <span className="font-normal"> · {seasonLabel(media.seasonNumber)}</span> : null}
    </>
  );
}
