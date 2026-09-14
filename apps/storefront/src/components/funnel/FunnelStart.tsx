"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { classifyFunnelError, startFunnelSession } from "@/lib/publicApi";
import { useStore } from "@/lib/StoreContext";
import { FunnelUnavailable } from "./FunnelStep";

const VISITOR_KEY = (workspaceId: string) => `zimos_funnel_visitor_${workspaceId}`;

/** Stable per-browser visitor id: the backend resumes that visitor's active session. */
function visitorId(workspaceId: string): string {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  try {
    const saved = window.localStorage.getItem(VISITOR_KEY(workspaceId));
    if (saved && saved.length <= 64) return saved;
    const id = fresh();
    window.localStorage.setItem(VISITOR_KEY(workspaceId), id);
    return id;
  } catch {
    return fresh();
  }
}

type State = "loading" | "notFound" | "paused" | "error";

export function FunnelStart({ workspaceId, funnelRef }: { workspaceId: string; funnelRef: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { t } = useStore();
  const [state, setState] = useState<State>("loading");
  const started = useRef(false);

  const start = useCallback(async () => {
    setState("loading");
    const attribution: Record<string, string> = {};
    search.forEach((value, key) => {
      if (/^(utm_|fbclid|gclid|ttclid|ref$)/.test(key)) attribution[key] = value.slice(0, 200);
    });
    try {
      const res = await startFunnelSession(
        createStorefrontApiClient(),
        workspaceId,
        funnelRef,
        visitorId(workspaceId),
        attribution
      );
      router.replace(`/store/${workspaceId}/f/${res.funnel.id}/${res.session.id}`);
    } catch (err) {
      const kind = classifyFunnelError(err);
      setState(kind === "paused" ? "paused" : kind === "notFound" ? "notFound" : "error");
    }
  }, [workspaceId, funnelRef, router, search]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  if (state === "notFound") notFound();
  if (state === "paused") return <FunnelUnavailable kind="paused" />;
  if (state === "error") return <FunnelUnavailable kind="error" onRetry={start} />;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <p role="status" className="flex items-center gap-3 text-sm text-ink-soft">
        <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-primary" />
        {t.funnel.starting}
      </p>
    </main>
  );
}
