import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import { useLocale } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "This page hit a problem",
    body: "The rest of the dashboard still works. Reload the page, or go back and try again.",
    reload: "Reload page",
  },
  ar: {
    title: "الصفحة دي حصل فيها مشكلة",
    body: "باقي لوحة التحكم شغال عادي. اعمل تحديث للصفحة أو ارجع وحاول تاني.",
    reload: "تحديث الصفحة",
  },
};

function Fallback({ error }: { error: unknown }) {
  const { locale } = useLocale();
  const t = STRINGS[locale];
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="mx-auto max-w-xl rounded-xl bg-paper-raised p-6 shadow-xs ring-1 ring-foreground/10">
      <h1 className="text-lg font-semibold text-ink">{t.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t.body}</p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-paper p-3 text-xs text-ink-soft" dir="ltr">
        {message}
      </pre>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          {t.reload}
        </Button>
      </div>
    </div>
  );
}

interface State {
  error: unknown;
  /** The path the error happened on; leaving it clears the boundary. */
  path: string;
}

/**
 * Keeps one page's crash inside the page: the chrome, the sidebar and every
 * other route stay usable, and navigating elsewhere resets the boundary.
 */
export class PageErrorBoundary extends Component<{ path: string; children: ReactNode }, State> {
  state: State = { error: null, path: "" };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: { path: string }, state: State): Partial<State> | null {
    if (state.error && state.path && state.path !== props.path) return { error: null, path: "" };
    if (state.error && !state.path) return { path: props.path };
    return null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  render() {
    return this.state.error ? <Fallback error={this.state.error} /> : this.props.children;
  }
}
