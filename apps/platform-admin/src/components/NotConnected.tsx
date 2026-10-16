import { PlugZap } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Mono } from "@/components/Panel";

interface NotConnectedProps {
  title: string;
  description: string;
  /** What this screen will show once the endpoints below exist. */
  summary: string;
  /** Endpoints the backend still has to implement, e.g. "GET /admin/tickets". */
  endpoints: string[];
}

/**
 * Placeholder for a console area whose backend endpoints don't exist yet.
 *
 * This deliberately shows nothing rather than sample rows: an admin reading
 * this console has no way to tell invented figures from real ones, so an
 * unimplemented screen states that plainly and names what it is waiting for.
 */
export function NotConnected({ title, description, summary, endpoints }: NotConnectedProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line bg-paper-raised/60 px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft">
          <PlugZap className="size-5 text-primary" aria-hidden />
        </span>
        <div className="max-w-md space-y-1.5">
          <h2 className="text-base font-semibold text-ink">Not connected yet</h2>
          <p className="text-sm text-ink-soft">{summary}</p>
        </div>
        <div className="w-full max-w-md border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Waiting on
          </p>
          <ul className="flex flex-col items-center gap-1.5">
            {endpoints.map((e) => (
              <li key={e}>
                <Mono>{e}</Mono>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
