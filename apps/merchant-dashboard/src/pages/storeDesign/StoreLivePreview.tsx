import { useState } from "react";
import { ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react";
import { cn } from "@store-builder/ui";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Live preview",
    hint: "Your store as shoppers see it. Save, then refresh to see the change.",
    phone: "Phone",
    desktop: "Desktop",
    refresh: "Refresh the preview",
    open: "Open the store in a new tab",
    frame: "Preview of your store",
  },
  ar: {
    title: "معاينة حيّة",
    hint: "متجرك كما يراه المشتري. احفظ ثم اضغط تحديث لترى التغيير.",
    phone: "موبايل",
    desktop: "ديسكتوب",
    refresh: "تحديث المعاينة",
    open: "فتح المتجر في تبويب جديد",
    frame: "معاينة متجرك",
  },
} satisfies Messages;

/** Width the desktop preview is laid out at before it is scaled down to the panel. */
const DESKTOP_WIDTH = 1280;
/** Inner width of the panel (22rem column minus its padding). */
const PANEL_WIDTH = 328;

/**
 * The real storefront beside the settings, so a merchant sees what a setting
 * does without leaving the page. It shows the published store: a change
 * appears after saving and refreshing.
 */
export function StoreLivePreview({ workspaceId, className }: { workspaceId: string; className?: string }) {
  const t = useT(STRINGS);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  // Bumped to reload the frame.
  const [version, setVersion] = useState(0);
  const url = `${STOREFRONT_URL}/store/${workspaceId}`;
  const scale = PANEL_WIDTH / DESKTOP_WIDTH;

  return (
    <aside aria-label={t.title} className={cn("rounded-2xl border border-line bg-paper-raised/75 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <div className="flex items-center gap-1">
          {(
            [
              ["phone", Smartphone, t.phone],
              ["desktop", Monitor, t.desktop],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDevice(value)}
              aria-pressed={device === value}
              aria-label={label}
              title={label}
              className={cn(
                "cursor-pointer rounded-lg p-2 transition-colors",
                device === value ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:bg-primary-soft/60 hover:text-ink"
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            aria-label={t.refresh}
            title={t.refresh}
            className="cursor-pointer rounded-lg p-2 text-ink-soft transition-colors hover:bg-primary-soft/60 hover:text-ink"
          >
            <RotateCw className="size-4" aria-hidden />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={t.open}
            title={t.open}
            className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-primary-soft/60 hover:text-ink"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.hint}</p>

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white" style={{ height: 620 }} dir="ltr">
        {device === "phone" ? (
          <iframe key={`phone-${version}`} src={url} title={t.frame} loading="lazy" className="block size-full border-0" />
        ) : (
          <iframe
            key={`desktop-${version}`}
            src={url}
            title={t.frame}
            loading="lazy"
            className="block border-0"
            style={{ width: DESKTOP_WIDTH, height: 620 / scale, transform: `scale(${scale})`, transformOrigin: "top left" }}
          />
        )}
      </div>
    </aside>
  );
}
