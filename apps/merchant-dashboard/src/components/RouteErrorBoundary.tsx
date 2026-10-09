import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import { StateMessage } from "@/components/DataState";
import { IconRefresh, IconWarning } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { errorReporter } from "@/lib/errorReporting";

const STRINGS = {
  en: {
    title: "This page didn't open",
    body: "Something broke while we were showing it. Reload and try again, or open another page from the menu.",
    reload: "Reload the page",
  },
  ar: {
    title: "الصفحة دي ما اتفتحتش",
    body: "حصلت مشكلة وإحنا بنعرضها. حدّث الصفحة وجرّب تاني، أو افتح صفحة تانية من القايمة.",
    reload: "حدّث الصفحة",
  },
} satisfies Messages;

/**
 * What a crashed page becomes: the same pane a failed load shows
 * (components/DataState.tsx), saying what happened and the two ways on —
 * reload, or the menu, which is still up. Inside the dashboard it takes the
 * page column; in a full-screen editor, which has no page padding, it keeps
 * its own margin.
 */
function RouteErrorFallback() {
  const t = useT(STRINGS);
  return (
    <StateMessage
      role="alert"
      tone="danger"
      icon={<IconWarning aria-hidden />}
      title={t.title}
      description={t.body}
      action={
        <Button variant="outline" onClick={() => window.location.reload()} className="min-h-11 rounded-full px-5">
          <IconRefresh weight="bold" className="size-4" aria-hidden />
          {t.reload}
        </Button>
      }
      className="mx-auto w-full max-w-xl [&:not(main_*)]:my-6 [&:not(main_*)]:w-[calc(100%-2rem)]"
    />
  );
}

interface Props {
  /** Clears a caught error when it changes, i.e. when the user navigates away. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorKey: string | null;
}

/**
 * Catches a render crash in one dashboard page so it shows a message in the
 * content area instead of unmounting the whole app. The sidebar and header
 * stay usable, and navigating to another page clears the error.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorKey: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // An error caught on one page must not stick to the next one.
    if (state.error && state.errorKey !== null && state.errorKey !== props.resetKey) {
      return { error: null, errorKey: null };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorKey: this.props.resetKey });
    console.error("Dashboard page crashed:", error, info.componentStack);
    // Caught here, so the page's global handler never sees it (packages/error-reporter).
    void errorReporter.report(error, { handled: true, boundary: "route" });
  }

  render() {
    return this.state.error ? <RouteErrorFallback /> : this.props.children;
  }
}
