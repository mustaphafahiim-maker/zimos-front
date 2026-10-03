import { useEffect, useRef } from "react";
import { inboxStreamUrl, type InboxStreamEvent } from "@store-builder/api-client";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";

/**
 * Live inbox updates: calls `onChange` whenever the server says a
 * conversation of this store changed (a message arrived, was sent, was read,
 * the chat was closed or assigned). The page's existing polling stays as the
 * safety net; this just makes new messages show up at once.
 *
 * One stream per store is shared by every component that uses the hook. A
 * dropped connection is reopened with a fresh ticket, backing off up to 30 s.
 */

type Listener = (event: InboxStreamEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const sources = new Map<string, { close: () => void }>();

function open(workspaceId: string) {
  let source: EventSource | null = null;
  let closed = false;
  let retry = 0;
  let timer: number | undefined;

  const connect = async () => {
    if (closed) return;
    try {
      const url = await inboxStreamUrl(apiClient, workspaceId, apiBaseUrl);
      if (closed) return;
      source = new EventSource(url);
      source.onmessage = (message) => {
        retry = 0;
        try {
          const event = JSON.parse(message.data) as InboxStreamEvent;
          if (event.type === "change") listeners.get(workspaceId)?.forEach((fn) => fn(event));
        } catch {
          /* not ours */
        }
      };
      source.onerror = () => {
        // The ticket in this URL is spent: never let EventSource retry it.
        source?.close();
        source = null;
        schedule();
      };
    } catch {
      schedule();
    }
  };
  const schedule = () => {
    if (closed) return;
    retry += 1;
    timer = window.setTimeout(() => void connect(), Math.min(30_000, 1000 * 2 ** Math.min(retry, 5)));
  };

  void connect();
  return {
    close() {
      closed = true;
      window.clearTimeout(timer);
      source?.close();
    },
  };
}

export function useInboxLive(workspaceId: string, onChange: Listener) {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });

  useEffect(() => {
    if (!workspaceId || typeof EventSource === "undefined") return;
    const listener: Listener = (event) => ref.current(event);
    let set = listeners.get(workspaceId);
    if (!set) {
      set = new Set();
      listeners.set(workspaceId, set);
    }
    set.add(listener);
    if (!sources.has(workspaceId)) sources.set(workspaceId, open(workspaceId));

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        listeners.delete(workspaceId);
        sources.get(workspaceId)?.close();
        sources.delete(workspaceId);
      }
    };
  }, [workspaceId]);
}
