"use client";

import { ArrowUpRight, Bookmark, Check, ChevronDown, LoaderCircle, PenLine, Search, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { FieldError } from "@/components/ui/form-message";
import { useFieldId } from "@/components/ui/use-field-id";
import { cn } from "@/lib/utils";
import { externalKey, titleKey, type ExistingMedia } from "../keys";
import { allTitles, formatTitle, nativeTitle } from "../titles";
import type { MediaSearchResult, SeasonOption } from "../providers/types";
import { MAX_BATCH, pickFromCatalog, type CatalogPick, type MediaTypeOption, type PickedItem } from "../types";
import { MediaCover } from "./media-cover";

type Mode = "search" | "picks" | "manual";
/** `key`: the type and query the results belong to, so a new query never shows the old answer. */
type SearchState = { key: string; loading: boolean; results: MediaSearchResult[]; failed: string[]; error?: string };

const NO_SEARCH: SearchState = { key: "", loading: false, results: [], failed: [] };

const NO_EXISTING: ExistingMedia = { keys: [], titles: [], links: {} };

function pickFromResult(result: MediaSearchResult, icon: string): PickedItem {
  return {
    key: externalKey(result.provider, result.externalId),
    label: formatTitle(result),
    names: allTitles(result),
    seasonNumber: null,
    meta: [result.year, result.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
    imageUrl: result.imageUrl,
    icon,
    mediaType: result.mediaType,
    fields: { source: "external", provider: result.provider, externalId: result.externalId },
  };
}

/** One season of a series result: "Lost · 2. Sezon", picked on its own. */
function pickFromSeason(series: MediaSearchResult, season: SeasonOption, icon: string): PickedItem {
  const named = { ...series, seasonNumber: season.seasonNumber };
  return {
    key: externalKey(series.provider, season.externalId),
    label: formatTitle(named),
    names: allTitles(named),
    seasonNumber: season.seasonNumber,
    meta: [season.year, season.episodes ? `${season.episodes} bölüm` : null].filter(Boolean).join(" · "),
    imageUrl: season.imageUrl ?? series.imageUrl,
    icon,
    mediaType: series.mediaType,
    fields: { source: "external", provider: series.provider, externalId: season.externalId },
  };
}

type SeasonsState = SeasonOption[] | "loading" | "error";

/**
 * The picker's basket, owned by the form around it. Whatever the list turns out to hold (the
 * page refreshed after a partial add, someone else added it meanwhile) drops out, since it can't
 * be added again.
 */
export function useBasket(existing: ExistingMedia = NO_EXISTING, initial: () => PickedItem[] = () => []) {
  const [picked, setPicked] = useState(initial);
  const [seen, setSeen] = useState(existing);
  if (existing !== seen) {
    setSeen(existing);
    setPicked((current) => current.filter((item) => !existing.keys.includes(item.key)));
  }
  return [picked, setPicked] as const;
}

/**
 * Chooses what to add: search the configured providers, pick from the user's own lists, or type
 * it in. Picks collect in a basket that survives new searches, so several items go in with one
 * click. Renders inside the parent <form>: the basket is the `items` field (JSON), a typed-in
 * item the plain manual fields; `readMediaToAdd` reads both.
 */
export function MediaPicker({
  mediaTypes,
  errors,
  picked,
  onPickedChange,
  onManualChange,
  maxItems = null,
  picks = [],
  existing = NO_EXISTING,
  manualKey = 0,
  autoFocus = false,
}: {
  mediaTypes: MediaTypeOption[];
  errors: Record<string, string[] | undefined>;
  picked: PickedItem[];
  onPickedChange: (items: PickedItem[]) => void;
  /** Whether a typed-in item goes with the submit (manual tab open, title filled in). */
  onManualChange?: (filled: boolean) => void;
  /** How many items may be added (e.g. what's left of a round's quota); null = up to the batch limit. */
  maxItems?: number | null;
  picks?: CatalogPick[];
  /** What the list already holds: such results can't be picked. */
  existing?: ExistingMedia;
  /** Changing it empties the manual fields (after they were added). */
  manualKey?: number;
  /** Puts the cursor in the search box: the user just asked to add something. */
  autoFocus?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [typeSlug, setTypeSlug] = useState(picked[0]?.mediaType ?? mediaTypes[0]?.slug ?? "");
  const type = mediaTypes.find((option) => option.slug === typeSlug) ?? mediaTypes[0];
  const canSearch = (type?.sources.length ?? 0) > 0;
  const [mode, setMode] = useState<Mode>(canSearch ? "search" : "manual");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>(NO_SEARCH);
  // Seasons of series results, fetched when first opened.
  const [seasons, setSeasons] = useState<Record<string, SeasonsState>>({});
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // The manual form starts from what was searched for, and empty again once it was added.
  const [manualSeed, setManualSeed] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [seenManualKey, setSeenManualKey] = useState(manualKey);
  if (manualKey !== seenManualKey) {
    setSeenManualKey(manualKey);
    setManualSeed("");
  }

  const limit = Math.min(maxItems ?? MAX_BATCH, MAX_BATCH);
  const typePicks = picks.filter((pick) => pick.mediaType === typeSlug);
  const effectiveMode: Mode =
    mode === "search" && !canSearch ? "manual" : mode === "picks" && typePicks.length === 0 ? "manual" : mode;
  const existingKeys = new Set(existing.keys);
  const existingTitles = new Set(existing.titles);
  const pickedKeys = new Set(picked.map((item) => item.key));
  const full = picked.length >= limit;
  const manualFilled = effectiveMode === "manual" && !full && manualTitle.trim() !== "";

  useEffect(() => {
    onManualChange?.(manualFilled);
  }, [manualFilled, onManualChange]);

  useEffect(() => {
    if (autoFocus) rootRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
  }, [autoFocus]);

  // Debounced search through our API route (keys stay on the server, responses are cached).
  useEffect(() => {
    const text = query.trim();
    if (effectiveMode !== "search" || text.length < 2) return;
    const key = `${typeSlug}|${text}`;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearch((previous) => ({ ...previous, loading: true, error: undefined }));
      try {
        const response = await fetch(`/api/media/search?type=${encodeURIComponent(typeSlug)}&q=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { results: MediaSearchResult[]; failed: string[] };
        setSearch({ key, loading: false, results: data.results, failed: data.failed });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearch({ ...NO_SEARCH, key, error: "Arama şu an yapılamadı. Elle ekleyebilirsin." });
          console.warn(error);
        }
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, typeSlug, effectiveMode]);

  function chooseType(slug: string) {
    const next = mediaTypes.find((option) => option.slug === slug);
    setTypeSlug(slug);
    setSearch(NO_SEARCH);
    setManualSeed("");
    setMode(next && next.sources.length > 0 ? "search" : "manual");
  }

  function openManual() {
    setManualSeed(query.trim());
    setMode("manual");
  }

  function toggle(item: PickedItem) {
    if (pickedKeys.has(item.key)) onPickedChange(picked.filter((entry) => entry.key !== item.key));
    // With room for one, picking another one swaps it.
    else if (limit === 1) onPickedChange([item]);
    else if (!full) onPickedChange([...picked, item]);
  }

  /** A warning for a result that goes by a name already in the list or among the picks. */
  function similarTo(item: PickedItem): string | null {
    const keys = item.names.map((name) => titleKey(item.mediaType, name, item.seasonNumber));
    if (keys.some((key) => existingTitles.has(key))) return "Listede aynı adla bir öge var";
    const twin = picked.find(
      (entry) => entry.key !== item.key && entry.names.some((name) => keys.includes(titleKey(entry.mediaType, name, entry.seasonNumber))),
    );
    return twin ? "Seçtiklerinde aynı adla bir öge var" : null;
  }

  /** Where the copy already in the list with one of this item's names can be seen. */
  const similarLink = (item: PickedItem) =>
    item.names.map((name) => existing.links[titleKey(item.mediaType, name, item.seasonNumber)]).find(Boolean) ?? null;

  async function toggleSeasons(result: MediaSearchResult, key: string) {
    if (openSeries === key) {
      setOpenSeries(null);
      return;
    }
    setOpenSeries(key);
    if (Array.isArray(seasons[key])) return;
    setSeasons((current) => ({ ...current, [key]: "loading" }));
    try {
      const response = await fetch(`/api/media/seasons?provider=${encodeURIComponent(result.provider)}&id=${encodeURIComponent(result.externalId)}`);
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { seasons: SeasonOption[] };
      setSeasons((current) => ({ ...current, [key]: data.seasons }));
    } catch (error) {
      console.warn(error);
      setSeasons((current) => ({ ...current, [key]: "error" }));
    }
  }

  function row(item: PickedItem, extra: string, badge: string | null, options: { indent?: boolean; seasons?: SeasonsToggle } = {}) {
    const selected = pickedKeys.has(item.key);
    return (
      <ResultRow
        key={item.key}
        {...options}
        item={item}
        selected={selected}
        inList={existingKeys.has(item.key)}
        link={existing.links[item.key] ?? null}
        warning={similarTo(item)}
        warningLink={similarLink(item)}
        disabled={full && !selected && limit > 1}
        extra={extra}
        badge={badge}
        onToggle={() => toggle(item)}
      />
    );
  }

  /**
   * Keyboard: Enter picks the first result not picked yet and selects the text, so the next title
   * can be typed right away; the down arrow moves into the results, the arrows walk them, Esc comes back.
   */
  function onFinderKeyDown(event: React.KeyboardEvent<HTMLInputElement>, items: PickedItem[], ready: boolean) {
    if (event.key === "Enter") {
      event.preventDefault(); // it would submit the form
      const next = ready ? items.find((item) => !existingKeys.has(item.key) && !pickedKeys.has(item.key)) : undefined;
      if (next && !(full && limit > 1)) {
        toggle(next);
        event.currentTarget.select();
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
  }

  function onResultsKeyDown(event: React.KeyboardEvent<HTMLUListElement>, input: HTMLInputElement | null) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[Math.min(index + 1, buttons.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index > 0) buttons[index - 1].focus();
      else input?.focus();
    } else if (event.key === "Escape") {
      input?.focus();
    }
  }

  const showResults = effectiveMode === "search" && query.trim().length >= 2;
  // Results for what is typed now (not while typing, nor while the answer is on its way).
  const settled = search.key === `${typeSlug}|${query.trim()}` && !search.loading;
  const needle = filter.trim().toLocaleLowerCase("tr-TR");
  const visiblePicks = needle
    ? typePicks.filter((pick) => [...allTitles(pick), ...pick.creators].some((text) => text.toLocaleLowerCase("tr-TR").includes(needle)))
    : typePicks;
  const found = search.results.map((result) => ({ result, item: pickFromResult(result, type.icon) }));
  const pickItems = visiblePicks.map((pick) => ({ pick, item: pickFromCatalog(pick) }));

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(picked.map((item) => ({ key: item.key, label: item.label, mediaType: item.mediaType, ...item.fields })))}
      />

      {mediaTypes.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="İçerik türü">
          {mediaTypes.map((option) => (
            <Button
              key={option.slug}
              variant={option.slug === typeSlug ? "default" : "outline"}
              size="sm"
              role="radio"
              aria-checked={option.slug === typeSlug}
              onClick={() => chooseType(option.slug)}
            >
              <span aria-hidden>{option.icon}</span> {option.label}
            </Button>
          ))}
        </div>
      ) : null}

      {canSearch || typePicks.length > 0 ? (
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {canSearch ? (
            <ModeTab active={effectiveMode === "search"} onClick={() => setMode("search")}>
              <Search className="size-4" /> Ara
            </ModeTab>
          ) : null}
          {typePicks.length > 0 ? (
            <ModeTab active={effectiveMode === "picks"} onClick={() => setMode("picks")}>
              <Bookmark className="size-4" /> Listelerimden
            </ModeTab>
          ) : null}
          <ModeTab active={effectiveMode === "manual"} onClick={openManual}>
            <PenLine className="size-4" /> Elle ekle
          </ModeTab>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{type?.label} için otomatik veri kaynağı yok; bilgileri elle girebilirsin.</p>
      )}

      {effectiveMode === "search" ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => onFinderKeyDown(event, found.map((entry) => entry.item), settled)}
              placeholder={`${type.label} adı yaz… (${type.sources.join(", ")})`}
              className="pl-9"
              aria-label="Ara"
            />
            {showResults && !settled ? (
              <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          {showResults ? (
            <div className="flex flex-col gap-2">
              {settled && search.error ? <p className="text-sm text-destructive">{search.error}</p> : null}
              {settled && search.failed.length > 0 ? (
                <p className="text-xs text-muted-foreground">{search.failed.join(", ")} şu an yanıt vermiyor.</p>
              ) : null}
              {settled && search.results.length === 0 && !search.error ? (
                <p className="text-sm text-muted-foreground">Sonuç bulunamadı.</p>
              ) : null}
              {search.results.length > 0 && limit > 1 ? (
                <p className="text-xs text-muted-foreground">
                  İstediğin kadarını seç; başka bir şey arayınca seçtiklerin kaybolmaz. Enter ilk sonucu seçer.
                </p>
              ) : null}
              <ul ref={listRef} onKeyDown={(event) => onResultsKeyDown(event, searchRef.current)} className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                {found.map(({ result, item }) => {
                  const open = openSeries === item.key;
                  const state = seasons[item.key];
                  return (
                    <Fragment key={item.key}>
                      {row(
                        item,
                        [result.year, nativeTitle(result), result.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
                        result.providerLabel,
                        result.hasSeasons ? { seasons: { open, onToggle: () => toggleSeasons(result, item.key) } } : {},
                      )}
                      {open && Array.isArray(state)
                        ? state.length > 0
                          ? state.map((season) => {
                              const seasonItem = pickFromSeason(result, season, type.icon);
                              return row(seasonItem, seasonItem.meta, null, { indent: true });
                            })
                          : <li className="py-1 pl-14 text-xs text-muted-foreground">Sezon bilgisi yok.</li>
                        : null}
                      {open && state === "loading" ? <li className="py-1 pl-14 text-xs text-muted-foreground">Sezonlar yükleniyor…</li> : null}
                      {open && state === "error" ? <li className="py-1 pl-14 text-xs text-destructive">Sezonlar şu an alınamadı.</li> : null}
                    </Fragment>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={openManual}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Aradığını bulamadın mı? Elle ekle
                </button>
                {/* Google Books' branding rules: "Powered by Google" next to its results, linking to google.com. */}
                {search.results.some((result) => result.provider === "google_books") ? (
                  <a href="https://www.google.com" target="_blank" rel="noreferrer" className="shrink-0 rounded bg-white px-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static attribution image from /public */}
                    <img src="/attribution/powered-by-google.png" alt="Powered by Google" width={62} height={30} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : effectiveMode === "picks" ? (
        <div className="flex flex-col gap-2">
          {typePicks.length > 6 ? (
            <Input
              ref={filterRef}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => onFinderKeyDown(event, pickItems.map((entry) => entry.item), true)}
              placeholder="Listelerinde ara…"
              aria-label="Listelerinde ara"
            />
          ) : null}
          <ul ref={listRef} onKeyDown={(event) => onResultsKeyDown(event, filterRef.current)} className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {pickItems.map(({ pick, item }) => row(item, item.meta, pick.listTitle))}
          </ul>
          {visiblePicks.length === 0 ? <p className="text-sm text-muted-foreground">Eşleşen öge yok.</p> : null}
        </div>
      ) : full ? (
        <p className="text-sm text-muted-foreground">
          Bir seferde en fazla {limit} öge ekleyebilirsin. Elle eklemek için seçtiklerinden birini kaldır.
        </p>
      ) : (
        <ManualFields
          key={`${typeSlug}-${manualKey}`}
          type={type}
          defaultTitle={manualSeed}
          errors={errors}
          withPicked={picked.length > 0}
          onTitleChange={setManualTitle}
        />
      )}
      {picked.length > 0 ? (
        // Below the results: picking or dropping an item never moves the list under the pointer.
        <div className="flex flex-col gap-2 rounded-xl border border-primary/60 bg-accent/60 p-3">
          <p className="text-sm font-medium">
            Seçilenler ({picked.length}
            {maxItems !== null ? ` / ${limit}` : ""})
          </p>
          <ul className="flex flex-col gap-1.5" aria-label="Seçilenler">
            {picked.map((item) => (
              <li key={item.key} className="flex items-center gap-2.5 rounded-lg bg-card px-2 py-1.5">
                <MediaCover src={item.imageUrl} title={item.label} icon={item.icon} className="w-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  {item.meta ? <span className="block truncate text-xs text-muted-foreground">{item.meta}</span> : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => toggle(item)}
                  aria-label={`“${item.label}” seçimini kaldır`}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          {full && limit > 1 ? <p className="text-xs text-muted-foreground">Bir seferde en fazla {limit} öge ekleyebilirsin.</p> : null}
        </div>
      ) : null}
      <FieldError errors={errors.items} />
    </div>
  );
}

type SeasonsToggle = { open: boolean; onToggle: () => void };

function ResultRow({
  item,
  selected,
  inList,
  link,
  warning,
  warningLink,
  disabled,
  extra,
  badge,
  onToggle,
  indent = false,
  seasons,
}: {
  item: PickedItem;
  selected: boolean;
  inList: boolean;
  /** Where the copy already in the list can be seen. */
  link: string | null;
  warning: string | null;
  warningLink: string | null;
  disabled: boolean;
  extra: string;
  badge: string | null;
  onToggle: () => void;
  /** A season under its series. */
  indent?: boolean;
  /** A series whose seasons can be picked one by one. */
  seasons?: SeasonsToggle;
}) {
  const seasonsButton = seasons ? (
    <button
      type="button"
      onClick={seasons.onToggle}
      aria-expanded={seasons.open}
      className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      Sezonlar <ChevronDown className={cn("size-3.5 transition-transform", seasons.open && "rotate-180")} />
    </button>
  ) : null;
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{item.label}</span>
      <span className="block truncate text-xs text-muted-foreground">
        {extra}
        {/* On phones the source moves under the title, leaving the title room. */}
        {badge && !inList ? <span className="sm:hidden">{extra ? " · " : ""}{badge}</span> : null}
      </span>
    </span>
  );

  // Already in the list: not pickable, but it leads to the copy that is there.
  if (inList) {
    return (
      <li className={cn("flex items-center gap-3 rounded-lg p-2", indent && "pl-10")}>
        <MediaCover src={item.imageUrl} title={item.label} icon={item.icon} className={cn("opacity-60", indent ? "w-8" : "w-10")} />
        <span className="flex min-w-0 flex-1 opacity-60">{text}</span>
        {link ? (
          <Link href={link} className="shrink-0 rounded-full" aria-label={`“${item.label}” listede: göster`}>
            <Badge tone="emerald">
              Listede <ArrowUpRight />
            </Badge>
          </Link>
        ) : (
          <Badge tone="emerald">Listede</Badge>
        )}
        {seasonsButton}
      </li>
    );
  }

  return (
    <li className={cn(indent && "pl-8")}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={selected}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
            selected && "bg-accent ring-1 ring-primary/60 hover:bg-accent",
          )}
        >
          <MediaCover src={item.imageUrl} title={item.label} icon={item.icon} className={indent ? "w-8" : "w-10"} />
          {text}
          {badge ? <Badge className="max-sm:hidden">{badge}</Badge> : null}
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
            )}
            aria-hidden
          >
            {selected ? <Check className="size-3.5" /> : null}
          </span>
        </button>
        {seasonsButton}
      </div>
      {warning ? (
        <p className="px-2 pb-1 text-xs text-amber-700 dark:text-amber-300">
          {warning}
          {warningLink && warning.startsWith("Listede") ? (
            <>
              {" · "}
              <Link href={warningLink} className="font-medium underline underline-offset-2">
                göster
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors",
        active ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? <Check className="size-4" /> : null}
      {children}
    </button>
  );
}

function ManualFields({
  type,
  defaultTitle,
  errors,
  withPicked,
  onTitleChange,
}: {
  type: MediaTypeOption;
  defaultTitle: string;
  errors: Record<string, string[] | undefined>;
  withPicked: boolean;
  onTitleChange: (title: string) => void;
}) {
  const fid = useFieldId();
  const [title, setTitle] = useState(defaultTitle);
  useEffect(() => {
    onTitleChange(title);
  }, [title, onTitleChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="source" value="manual" />
      <input type="hidden" name="mediaType" value={type.slug} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={fid("title")}>Başlık</Label>
        <Input id={fid("title")} name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
        {withPicked ? <p className="text-xs text-muted-foreground">Doldurursan seçtiklerinle birlikte eklenir.</p> : null}
        <FieldError errors={errors.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("originalTitle")}>Orijinal başlık</Label>
        <Input id={fid("originalTitle")} name="originalTitle" maxLength={200} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("year")}>Yıl</Label>
        <Input id={fid("year")} name="year" type="number" min={1000} max={2100} />
        <FieldError errors={errors.year} />
      </div>
      {type.slug === "tv" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={fid("seasonNumber")}>Sezon (isteğe bağlı)</Label>
          <Input id={fid("seasonNumber")} name="seasonNumber" type="number" min={1} max={200} placeholder="ör. 2" />
          <FieldError errors={errors.seasonNumber} />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={fid("creators")}>{type.creatorLabel} (virgülle ayır)</Label>
        <Input id={fid("creators")} name="creators" maxLength={300} />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={fid("imageUrl")}>Kapak / afiş görseli adresi</Label>
        <Input id={fid("imageUrl")} name="imageUrl" type="url" placeholder="https://…" />
        <FieldError errors={errors.imageUrl} />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={fid("description")}>Kısa açıklama</Label>
        <Textarea id={fid("description")} name="description" rows={3} maxLength={2000} />
      </div>
    </div>
  );
}
