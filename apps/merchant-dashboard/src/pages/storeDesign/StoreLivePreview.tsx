import { useEffect, useRef, useState } from "react";
import { IconDesktop, IconExternal, IconPhoneDevice, IconRotate } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Segmented } from "@/components/Segmented";

const STRINGS = {
  en: {
    title: "Live preview",
    hint: "Your published store, as shoppers see it now. Save a change, then refresh to see it here.",
    device: "Screen",
    phone: "Phone",
    desktop: "Desktop",
    refresh: "Refresh",
    refreshLabel: "Refresh the preview",
    open: "Open the store",
    openLabel: "Open the store in a new tab",
    frame: "Preview of your store",
  },
  ar: {
    title: "معاينة حيّة",
    hint: "متجرك المنشور زي ما العميل شايفه دلوقتي. احفظ التغيير وبعدين دوس «حدّث» عشان يبان هنا.",
    device: "الشاشة",
    phone: "موبايل",
    desktop: "كمبيوتر",
    refresh: "حدّث",
    refreshLabel: "حدّث المعاينة",
    open: "افتح المتجر",
    openLabel: "افتح المتجر في تبويب جديد",
    frame: "معاينة متجرك",
  },
} satisfies Messages;

/** Width the desktop preview is laid out at before it is scaled down to the box. */
const DESKTOP_WIDTH = 1280;
/** The phone the preview stands for. */
const PHONE_WIDTH = 390;
/** As tall as a phone screen, but never taller than the sheet can show without scrolling. */
const FRAME_HEIGHT = "min(620px, 58dvh)";

type Device = "phone" | "desktop";

/**
 * The real storefront, so a merchant sees what a setting does without leaving
 * the page. It shows the published store: a change appears after saving and
 * refreshing. It fills whatever holds it (the «شوف المتجر» sheet): the desktop
 * view is laid out at 1280px and scaled to the box it was given.
 */
export function StoreLivePreview({ workspaceId, className }: { workspaceId: string; className?: string }) {
  const t = useT(STRINGS);
  const [device, setDevice] = useState<Device>("phone");
  // Bumped to reload the frame.
  const [version, setVersion] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const url = `${STOREFRONT_URL}/store/${workspaceId}`;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBoxWidth(box.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const scale = boxWidth > 0 ? Math.min(1, boxWidth / DESKTOP_WIDTH) : 0.3;

  return (
    <aside aria-label={t.title} className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label={t.device}
          size="sm"
          value={device}
          onChange={setDevice}
          options={[
            { value: "phone", label: t.phone, icon: IconPhoneDevice },
            { value: "desktop", label: t.desktop, icon: IconDesktop },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full px-4 sm:min-h-9"
            onClick={() => setVersion((v) => v + 1)}
            aria-label={t.refreshLabel}
          >
            <IconRotate className="size-4" aria-hidden />
            {t.refresh}
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9">
            <a href={url} target="_blank" rel="noreferrer" aria-label={t.openLabel}>
              <IconExternal className="size-4" aria-hidden />
              {t.open}
            </a>
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-ink-soft">{t.hint}</p>

      {/* The store is always drawn left to right inside its own frame, whatever the dashboard's direction. */}
      <div
        ref={boxRef}
        dir="ltr"
        className="relative mt-3 flex justify-center overflow-hidden rounded-xl bg-paper-sunken ring-1 ring-line"
        style={{ height: FRAME_HEIGHT }}
      >
        {device === "phone" ? (
          <iframe
            key={`phone-${version}`}
            src={url}
            title={t.frame}
            loading="lazy"
            className="block h-full w-full border-0 bg-white"
            style={{ maxWidth: PHONE_WIDTH }}
          />
        ) : (
          <iframe
            key={`desktop-${version}`}
            src={url}
            title={t.frame}
            loading="lazy"
            // Laid out at desktop width, then scaled to the box from its start corner (the frame is an LTR island).
            className="absolute start-0 top-0 block border-0 bg-white"
            style={{ width: DESKTOP_WIDTH, height: `calc(${FRAME_HEIGHT} / ${scale})`, transform: `scale(${scale})`, transformOrigin: "top left" }}
          />
        )}
      </div>
    </aside>
  );
}
