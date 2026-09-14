import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, CircleAlert, ExternalLink, FilePlus2, History, Languages, ListChecks, LoaderCircle, Maximize2, Monitor, MoreHorizontal, Plus, Redo2, Rocket, Save, Smartphone, Tablet, Trash2, Undo2 } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { RendererLocale } from "@store-builder/store-renderer";
import type { EditorPage } from "./editorState";
import { pageDisplayName } from "./elementLibrary";
import type { Device } from "./Canvas";
import { useBuilderT } from "./strings";

export type SaveStatus = "saved" | "saving" | "dirty" | "error";

function PageSwitcher({
  pages,
  currentPageId,
  uiLocale,
  onSelect,
  onAdd,
  onDelete,
}: {
  pages: EditorPage[];
  currentPageId: string | null;
  uiLocale: RendererLocale;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (page: EditorPage) => void;
}) {
  const t = useBuilderT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = pages.find((p) => p.id === currentPageId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.pages}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 min-w-44 cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium text-ink hover:border-primary"
      >
        <span className="truncate">{current ? pageDisplayName(current, uiLocale) : t.pages}</span>
        <ChevronDown className="size-4 text-ink-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-line bg-paper-raised shadow-pop">
          <ul role="listbox" aria-label={t.pages} className="max-h-80 overflow-y-auto py-1">
            {pages.map((p) => (
              <li key={p.id} role="option" aria-selected={p.id === currentPageId} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm hover:bg-primary-soft", p.id === currentPageId && "font-semibold text-primary")}
                >
                  <Check className={cn("size-4 shrink-0", p.id === currentPageId ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="truncate">{pageDisplayName(p, uiLocale)}</span>
                  <bdi dir="ltr" className="ms-auto shrink-0 font-mono text-[11px] text-ink-muted">
                    {p.path}
                  </bdi>
                </button>
                {p.pageType !== "home" && p.path !== "/" && (
                  <button type="button" onClick={() => { setOpen(false); onDelete(p); }} aria-label={`${t.deletePage}: ${p.title}`} title={t.deletePage} className="me-1 cursor-pointer rounded-md p-1.5 text-ink-muted opacity-0 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
            className="flex w-full cursor-pointer items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            <FilePlus2 className="size-4" aria-hidden />
            {t.addPage}
          </button>
        </div>
      )}
    </div>
  );
}

type MoreItem = { label: string; Icon: typeof Monitor; onClick?: () => void; href?: string; active?: boolean };

/** Phone-width overflow menu for the actions that don't fit the bar. */
function MoreMenu({ items }: { items: MoreItem[] }) {
  const t = useBuilderT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const row = "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm text-ink hover:bg-primary-soft";
  return (
    <div ref={ref} className="relative md:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={t.more} title={t.more} className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-primary-soft hover:text-primary">
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-11 z-50 w-56 rounded-xl border border-line bg-paper-raised p-1 shadow-pop">
          {items.map(({ label, Icon, onClick, href, active }) =>
            href ? (
              <a key={label} role="menuitem" href={href} target="_blank" rel="noopener noreferrer" className={row} onClick={() => setOpen(false)}>
                <Icon className="size-4 text-ink-soft" aria-hidden />
                {label}
              </a>
            ) : (
              <button
                key={label}
                type="button"
                role="menuitem"
                className={cn(row, active && "font-semibold text-primary")}
                onClick={() => {
                  onClick?.();
                  setOpen(false);
                }}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "text-ink-soft")} aria-hidden />
                {label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  storeName,
  pages,
  currentPageId,
  uiLocale,
  onSelectPage,
  onAddPage,
  onDeletePage,
  device,
  onDevice,
  fit,
  onToggleFit,
  previewLocale,
  onPreviewLocale,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  status,
  onSave,
  liveUrl,
  onPublish,
  onHistory,
  onBack,
  onGuide,
}: {
  storeName: string;
  pages: EditorPage[];
  currentPageId: string | null;
  uiLocale: RendererLocale;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (page: EditorPage) => void;
  device: Device;
  onDevice: (d: Device) => void;
  fit: boolean;
  onToggleFit: () => void;
  previewLocale: RendererLocale;
  onPreviewLocale: (l: RendererLocale) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  status: SaveStatus;
  onSave: () => void;
  liveUrl: string;
  onPublish: () => void;
  onHistory: () => void;
  onBack: () => void;
  onGuide: () => void;
}) {
  const t = useBuilderT();
  const iconBtn = "flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  const devices: Array<{ id: Device; label: string; Icon: typeof Monitor }> = [
    { id: "desktop", label: t.deviceDesktop, Icon: Monitor },
    { id: "tablet", label: t.deviceTablet, Icon: Tablet },
    { id: "mobile", label: t.deviceMobile, Icon: Smartphone },
  ];
  const statusView = {
    saved: { text: t.statusSaved, cls: "text-ink-soft", Icon: Check },
    saving: { text: t.statusSaving, cls: "text-ink-soft", Icon: LoaderCircle },
    dirty: { text: t.statusDirty, cls: "text-warning", Icon: CircleAlert },
    error: { text: t.statusError, cls: "text-danger", Icon: CircleAlert },
  }[status];

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line bg-paper-raised px-2 sm:gap-2 sm:px-3">
      <button type="button" onClick={onBack} className={iconBtn} aria-label={t.back} title={t.back}>
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
      </button>
      <span dir="auto" className="hidden max-w-40 truncate text-sm font-bold text-ink xl:block">
        {storeName}
      </span>
      <span className="mx-1 hidden h-6 w-px bg-line xl:block" aria-hidden />
      <PageSwitcher pages={pages} currentPageId={currentPageId} uiLocale={uiLocale} onSelect={onSelectPage} onAdd={onAddPage} onDelete={onDeletePage} />
      <button type="button" onClick={onAddPage} className={cn(iconBtn, "hidden 2xl:flex")} aria-label={t.addPage} title={t.addPage}>
        <Plus className="size-4" aria-hidden />
      </button>

      <div className="mx-auto flex items-center gap-1">
        <div className="flex items-center gap-1 max-md:hidden">
        <div role="radiogroup" aria-label={t.deviceDesktop} className="flex rounded-lg border border-line bg-paper p-0.5">
          {devices.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={device === id}
              aria-label={label}
              title={label}
              onClick={() => onDevice(id)}
              className={cn("flex h-8 w-9 cursor-pointer items-center justify-center rounded-md", device === id ? "bg-primary text-white" : "text-ink-soft hover:text-primary")}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
        <button type="button" onClick={onToggleFit} aria-pressed={fit} className={cn(iconBtn, fit && "text-primary")} aria-label={fit ? t.zoom100 : t.zoomFit} title={fit ? t.zoom100 : t.zoomFit}>
          <Maximize2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onPreviewLocale(previewLocale === "ar" ? "en" : "ar")}
          className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:bg-primary-soft hover:text-primary"
          aria-label={`${t.previewLang}: ${previewLocale.toUpperCase()}`}
          title={t.previewLang}
        >
          <Languages className="size-4" aria-hidden />
          {previewLocale === "ar" ? "ع" : "EN"}
        </button>
        </div>
        <span className="mx-1 h-6 w-px bg-line max-md:hidden" aria-hidden />
        <button type="button" onClick={onUndo} disabled={!canUndo} className={iconBtn} aria-label={t.undo} title={t.undo}>
          <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className={iconBtn} aria-label={t.redo} title={t.redo}>
          <Redo2 className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>

      <span role="status" aria-live="polite" className={cn("hidden items-center gap-1.5 whitespace-nowrap text-xs font-medium lg:flex", statusView.cls)}>
        <statusView.Icon className={cn("size-3.5", status === "saving" && "animate-spin")} aria-hidden />
        {statusView.text}
      </span>
      <MoreMenu
        items={[
          ...devices.map((d) => ({ label: d.label, Icon: d.Icon, active: device === d.id, onClick: () => onDevice(d.id) })),
          { label: `${t.previewLang}: ${previewLocale === "ar" ? "EN" : "ع"}`, Icon: Languages, onClick: () => onPreviewLocale(previewLocale === "ar" ? "en" : "ar") },
          { label: t.guideOpen, Icon: ListChecks, onClick: onGuide },
          { label: t.history, Icon: History, onClick: onHistory },
          { label: t.previewLive, Icon: ExternalLink, href: liveUrl },
        ]}
      />
      <button type="button" onClick={onGuide} className={cn(iconBtn, "max-md:hidden")} aria-label={t.guideOpen} title={t.guideOpen}>
        <ListChecks className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onHistory} className={cn(iconBtn, "max-md:hidden")} aria-label={t.history} title={t.history}>
        <History className="size-4" aria-hidden />
      </button>
      <Button type="button" variant="ghost" size="sm" onClick={onSave} disabled={status === "saving" || status === "saved"} aria-label={t.save} title="Ctrl+S">
        <Save className="size-4" aria-hidden />
        <span className="hidden 2xl:inline">{t.save}</span>
      </Button>
      <Button asChild type="button" variant="outline" size="sm" className="max-md:hidden">
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" title={t.previewLive}>
          <ExternalLink className="size-4" aria-hidden />
          <span className="hidden xl:inline">{t.previewLive}</span>
        </a>
      </Button>
      <Button type="button" size="sm" onClick={onPublish}>
        <Rocket className="size-4 rtl:-scale-x-100" aria-hidden />
        <span className="max-sm:sr-only">{t.publish}</span>
      </Button>
    </header>
  );
}
