import { useRef, useState } from "react";
import { IconDelete, IconUpload } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import { storeFontsDelete, storeFontsUpload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { Field } from "@/components/Field";
import { useEditorLocale } from "./editorLocale";
import { FontSelect, useStoreFonts } from "./FontSelect";
import type { StoreLook } from "./storeLook";

/**
 * The store's body and heading fonts over the look's own (Google fonts or
 * uploaded ones), and the uploaded fonts themselves — the full controls under
 * the theme panel's font pairs (theme/FontPairList.tsx). The fonts are saved
 * with the look; an upload is stored at once.
 */

const STRINGS = {
  en: {
    title: "Your fonts",
    hint: "Pick any Google font, or upload your own, for the whole store. Each element can also have its own font (Style tab).",
    body: "Body font",
    heading: "Heading font",
    lookFont: "The look's own font",
    uploadTitle: "Upload a font",
    uploadHint: "WOFF2, WOFF, TTF or OTF, up to 2MB. Use a font you have the right to use on the web.",
    name: "Font name",
    namePlaceholder: "e.g. Brand Sans",
    choose: "Choose a file",
    uploading: "Uploading…",
    remove: "Delete {name}",
    needName: "Name the font first.",
  },
  ar: {
    title: "خطوطك",
    hint: "اختار أي خط من Google أو ارفع خطك للمتجر كله. وكمان كل عنصر ممكن ياخد خط لوحده (تبويب الشكل).",
    body: "خط النصوص",
    heading: "خط العناوين",
    lookFont: "خط المظهر نفسه",
    uploadTitle: "رفع خط",
    uploadHint: "WOFF2 أو WOFF أو TTF أو OTF لحد 2 ميجا. استخدم خط من حقك تستخدمه على الويب.",
    name: "اسم الخط",
    namePlaceholder: "مثلًا: خط البراند",
    choose: "اختار ملف",
    uploading: "بنرفع…",
    remove: "امسح {name}",
    needName: "اكتب اسم الخط الأول.",
  },
} as const;

/** The store's uploaded fonts as `useStoreFonts` loads them — passed in by a parent that already has them. */
type StoreFontsState = ReturnType<typeof useStoreFonts>;

interface StoreFontsProps {
  look: StoreLook;
  onChange: (next: StoreLook) => void;
}

export function StoreFontsSection({
  look,
  onChange,
  fonts,
}: StoreFontsProps & {
  /** The uploaded fonts, when the caller has already loaded them; otherwise the section loads its own. */
  fonts?: StoreFontsState;
}) {
  return fonts ? (
    <StoreFontsFields look={look} onChange={onChange} fonts={fonts} />
  ) : (
    <SelfLoadedFonts look={look} onChange={onChange} />
  );
}

function SelfLoadedFonts({ look, onChange }: StoreFontsProps) {
  const fonts = useStoreFonts();
  return <StoreFontsFields look={look} onChange={onChange} fonts={fonts} />;
}

function StoreFontsFields({ look, onChange, fonts }: StoreFontsProps & { fonts: StoreFontsState }) {
  const t = STRINGS[useEditorLocale()];
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const uploaded = fonts.data ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!name.trim()) return setError(t.needName);
    setBusy(true);
    setError(null);
    try {
      const font = await storeFontsUpload(apiClient, workspaceId, file, name.trim());
      setName("");
      await fonts.refresh({ silent: true });
      // A first upload is most likely meant for the store's text.
      if (!look.bodyFont) onChange({ ...look, bodyFont: `c:${font.id}` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await storeFontsDelete(apiClient, workspaceId, id);
      await fonts.refresh({ silent: true });
      const ref = `c:${id}`;
      if (look.bodyFont === ref || look.headingFont === ref) {
        onChange({
          ...look,
          bodyFont: look.bodyFont === ref ? "" : look.bodyFont,
          headingFont: look.headingFont === ref ? "" : look.headingFont,
        });
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section data-slot="store-fonts" className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-ink">{t.title}</h4>
        <p className="mt-1 text-xs text-ink-soft">{t.hint}</p>
      </div>
      <Field label={t.heading}>
        {({ id }) => (
          <FontSelect
            id={id}
            value={look.headingFont ?? ""}
            emptyLabel={t.lookFont}
            uploaded={uploaded}
            onChange={(ref) => onChange({ ...look, headingFont: ref })}
          />
        )}
      </Field>
      <Field label={t.body}>
        {({ id }) => (
          <FontSelect
            id={id}
            value={look.bodyFont ?? ""}
            emptyLabel={t.lookFont}
            uploaded={uploaded}
            onChange={(ref) => onChange({ ...look, bodyFont: ref })}
          />
        )}
      </Field>

      <div className="zimos-look-row space-y-2.5 rounded-[0.875rem] bg-paper-raised p-3 ring-1 ring-line">
        <div>
          <p className="text-sm font-medium text-ink">{t.uploadTitle}</p>
          <p className="mt-1 text-xs text-ink-soft">{t.uploadHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t.name}
            placeholder={t.namePlaceholder}
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[8rem] flex-1"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
            className="sr-only"
            aria-label={t.choose}
            tabIndex={-1}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => (name.trim() ? fileRef.current?.click() : setError(t.needName))}
          >
            <IconUpload className="size-4" aria-hidden />
            {busy ? t.uploading : t.choose}
          </Button>
        </div>
        {uploaded.length > 0 && (
          <ul className="divide-y divide-line">
            {uploaded.map((font) => (
              <li key={font.id} className="flex min-h-11 items-center justify-between gap-2 text-sm text-ink">
                <span className="min-w-0 truncate" dir="auto">
                  {font.name} <span className="text-xs text-ink-soft">({font.format})</span>
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t.remove.replace("{name}", font.name)}
                  onClick={() => void remove(font.id)}
                >
                  <IconDelete className="size-4 text-danger" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
    </section>
  );
}
