/**
 * Only reachable without a store in the host — in development, or through a
 * deploy's own hostname. In production every such request is sent to the
 * marketing site before it gets here (see `proxy.ts`).
 */
export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-medium text-ink">Store Builder</h1>
      <p className="mt-3 max-w-md text-sm text-ink-soft">
        Each store is served on its own subdomain,{" "}
        <code className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-dark">
          &lt;slug&gt;.zimos.co
        </code>
        . Browsers resolve <code className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-dark">
          &lt;slug&gt;.localhost
        </code>{" "}
        on their own, so the same routing works here — or open a store directly
        at{" "}
        <code className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-dark">
          /store/&lt;workspaceId&gt;
        </code>
        .
      </p>
    </main>
  );
}
