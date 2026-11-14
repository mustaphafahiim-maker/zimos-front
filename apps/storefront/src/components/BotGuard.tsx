"use client";

import { useEffect, useMemo } from "react";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { primeBotGuard, setBotGuardHoneypot } from "@/lib/botGuard";

/**
 * Primes the checkout's bot guard when a store page opens, and holds its
 * honeypot: a field no shopper can see, reach by keyboard or have autofilled.
 * A script that fills every input it finds gives itself away.
 */
export function BotGuard({ workspaceId }: { workspaceId: string }) {
  const client = useMemo(() => createStorefrontApiClient(), []);
  useEffect(() => {
    void primeBotGuard(client, workspaceId);
  }, [client, workspaceId]);

  return (
    <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Website
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
          onChange={(e) => setBotGuardHoneypot(e.target.value)}
        />
      </label>
    </div>
  );
}
