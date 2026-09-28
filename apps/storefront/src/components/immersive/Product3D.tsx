"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BoxIcon } from "../Icons";
import type { Dictionary } from "@/lib/i18n";

// three.js and the viewer are a separate chunk, fetched on the click — never
// as part of the product page itself.
const ModelViewer = dynamic(() => import("./ModelViewer").then((m) => m.ModelViewer), { ssr: false });

/**
 * The product as a real object: a still photo with a "view in 3D" button, and
 * the spinnable model once the shopper asks for it.
 *
 * The photo is the product page's normal image, so a shopper who never presses
 * the button pays nothing for this block.
 */
export function Product3D({ src, poster, name, t }: { src: string; poster?: string; name: string; t: Dictionary }) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  if (open) {
    return (
      <div className="flex flex-col gap-2">
        <ModelViewer
          src={src}
          alt={t.immersive.modelOf(name)}
          closeLabel={t.immersive.close3d}
          loadingLabel={t.immersive.loading3d}
          errorLabel={t.immersive.failed3d}
          onClose={() => setOpen(false)}
        />
        <p className="text-center text-xs text-ink-soft">{t.immersive.spinHint}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-paper">
      {poster ? (
        // Merchant media are arbitrary remote URLs (no next/image allowlist).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={name} width={900} height={900} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary/40">
          <BoxIcon size={72} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-3 end-3 cursor-pointer rounded-full border border-line bg-paper-raised px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:border-primary"
      >
        {t.immersive.view3d}
      </button>
    </div>
  );
}
