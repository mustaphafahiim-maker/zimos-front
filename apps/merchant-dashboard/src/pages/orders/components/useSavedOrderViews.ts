import { useEffect, useState } from "react";
import { savedViewsList, savedViewsRemove, savedViewsSave, type SavedListView } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

/**
 * The orders list's saved views, kept per teammate on the server
 * (workspaces/savedViews.js) so they follow the person to any browser.
 * Views saved in this browser before that move are copied up once.
 */
export function useSavedOrderViews() {
  const workspaceId = useWorkspaceId();
  const [views, setViews] = useState<SavedListView[]>([]);

  useEffect(() => {
    let cancelled = false;
    const legacyKey = `zimos.orders.views.${workspaceId}`;
    (async () => {
      let legacy: Array<{ name: string; query: string }> = [];
      try {
        legacy = JSON.parse(window.localStorage.getItem(legacyKey) || "[]");
      } catch {
        legacy = [];
      }
      if (Array.isArray(legacy) && legacy.length > 0) {
        for (const v of legacy) await savedViewsSave(apiClient, workspaceId, { scope: "orders", name: v.name, query: v.query }).catch(() => undefined);
        try {
          window.localStorage.removeItem(legacyKey);
        } catch {
          // Copied again next time, harmlessly (a name is replaced, not doubled).
        }
      }
      const list = await savedViewsList(apiClient, workspaceId, "orders").catch(() => [] as SavedListView[]);
      if (!cancelled) setViews(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return {
    views,
    save: (name: string, query: string) => {
      void savedViewsSave(apiClient, workspaceId, { scope: "orders", name, query }).then((saved) =>
        setViews((list) => [...list.filter((v) => v.name !== saved.name), saved].sort((a, b) => a.name.localeCompare(b.name)))
      );
    },
    remove: (name: string) => {
      const view = views.find((v) => v.name === name);
      if (!view) return;
      setViews((list) => list.filter((v) => v.id !== view.id));
      void savedViewsRemove(apiClient, workspaceId, view.id).catch(() => undefined);
    },
  };
}
