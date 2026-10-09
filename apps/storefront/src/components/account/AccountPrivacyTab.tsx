"use client";

import { useEffect, useRef } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { usePrivacyCopy } from "./privacyCopy";

/**
 * The account's «الخصوصية» tab (handoff 235), for the shell's tab list. The
 * page itself is in AccountPrivacy.tsx; this file stands apart so the shell
 * can import it without importing a page that imports the shell.
 */

export const PRIVACY_PATH = "/account/privacy";

/** Whether an account path is the privacy page (the shell's own tabs then stand unselected). */
export function isAccountPrivacyPath(pathname: string): boolean {
  return pathname.endsWith(PRIVACY_PATH);
}

export function AccountPrivacyTab({ pathname }: { pathname: string }) {
  const copy = usePrivacyCopy();
  const selected = isAccountPrivacyPath(pathname);
  const item = useRef<HTMLLIElement>(null);

  // The last tab of a row that scrolls sideways on a phone: brought into view when it is the page being
  // read — and again when the row grows, since other tabs join it once their own data has loaded.
  useEffect(() => {
    const tab = item.current;
    if (!selected || !tab) return;
    // "center" takes the row to its end for the last tab, so the row's own gutter stays beside it.
    const show = () => tab.scrollIntoView({ block: "nearest", inline: "center" });
    show();
    const row = tab.parentElement;
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(show);
    observer.observe(row);
    return () => observer.disconnect();
  }, [selected]);

  return (
    <li ref={item}>
      <StoreLink href={PRIVACY_PATH} aria-current={selected ? "page" : undefined} className={`${selected ? btnPrimary : btnSecondary} whitespace-nowrap`}>
        {copy.tab}
      </StoreLink>
    </li>
  );
}
