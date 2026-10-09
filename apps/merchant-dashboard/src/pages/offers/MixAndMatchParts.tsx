import { IconShuffle } from "@/components/icons";
import { bundleIsMixAndMatch, type BundleDto } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { storeUrl } from "@/lib/storeAddress";
import { CopyButton } from "@/components/CopyButton";

/**
 * Mix-and-match boxes (handoff 215) on the quantity bundles: the editor's
 * switch, and the list's badge with the box page's link. A mix-and-match
 * bundle prices all its products together — "any 3 of these for EGP 400" —
 * and the store gets a "Build your box" page for it.
 */

const STRINGS = {
  en: {
    toggle: "Mix and match",
    hint: "These products count together: any 3 of them for one price. The store gets a “Build your box” page.",
    hintTip: "For “any 3 for EGP 400”, use a 3-piece tier with Fixed price for the tier = 400.",
    badge: "Mix and match",
    copyLink: "Copy box link",
  },
  ar: {
    toggle: "اخلط واختار",
    hint: "المنتجات دي بتتحسب مع بعض: أي 3 منهم بسعر واحد. والمتجر بيبقى فيه صفحة «كوّن البوكس بتاعك».",
    hintTip: "عشان «أي 3 بـ 400 ج.م»، اعمل شريحة 3 قطع بنوع «سعر ثابت للشريحة» = 400.",
    badge: "اخلط واختار",
    copyLink: "انسخ لينك البوكس",
  },
} satisfies Messages;

/** The editor's switch, under the bundle's name. */
export function MixAndMatchToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const t = useT(STRINGS);
  return (
    <label data-slot="offer-tier" className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.875rem] bg-paper-raised p-3 ring-1 ring-line sm:col-span-2">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <IconShuffle className="size-4 text-primary" aria-hidden />
          {t.toggle}
        </span>
        <span className="block text-xs text-ink-soft">{t.hint}</span>
        {checked && <span className="mt-1 block text-xs text-ink-soft">{t.hintTip}</span>}
      </span>
    </label>
  );
}

/** The list's badge and the box page's link, for a mix-and-match bundle only. */
export function MixAndMatchNote({ bundle }: { bundle: BundleDto }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  if (!bundleIsMixAndMatch(bundle)) return null;
  const link = currentWorkspace?.slug ? `${storeUrl(currentWorkspace.slug)}/box/${bundle.id}` : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
        <IconShuffle className="size-3.5" aria-hidden />
        {t.badge}
      </span>
      {link && bundle.isActive && <CopyButton value={link} label={t.copyLink} className="min-h-11" />}
    </div>
  );
}
