import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { isChunkLoadError } from "@/pages/orders/newOrder";

const STRINGS = {
  en: {
    title: "Something went wrong on this page",
    body: "The rest of the dashboard still works. Try again, or head back home.",
    chunkTitle: "A new version is available",
    chunkBody: "ZIMOS was updated while this tab was open. Reload to get the latest version.",
    retry: "Try again",
    reload: "Reload",
    home: "Go home",
    details: "Technical details",
  },
  ar: {
    title: "حدث خطأ في هذه الصفحة",
    body: "باقي لوحة التحكم يعمل بشكل طبيعي. حاول مرة أخرى أو ارجع للرئيسية.",
    chunkTitle: "يتوفر إصدار جديد",
    chunkBody: "تم تحديث زيموس أثناء فتح هذه الصفحة. أعد التحميل للحصول على أحدث إصدار.",
    retry: "حاول مرة أخرى",
    reload: "إعادة التحميل",
    home: "الرئيسية",
    details: "تفاصيل تقنية",
  },
};

function ErrorCard({ error, onReset }: { error: unknown; onReset: () => void }) {
  const t = useT(STRINGS);
  const chunk = isChunkLoadError(error);
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="mx-auto my-10 max-w-lg rounded-[20px] border border-line bg-paper-raised p-6 text-center shadow-[var(--shadow-pop)]">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        {chunk ? <RefreshCw className="size-6" aria-hidden /> : <AlertTriangle className="size-6" aria-hidden />}
      </div>
      <h2 className="text-lg font-semibold text-ink">{chunk ? t.chunkTitle : t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{chunk ? t.chunkBody : t.body}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {chunk ? (
          <Button onClick={() => window.location.reload()}>{t.reload}</Button>
        ) : (
          <Button onClick={onReset}>{t.retry}</Button>
        )}
        <Link to="/" onClick={onReset} className={buttonVariants({ variant: "outline" })}>
          {t.home}
        </Link>
      </div>
      {!chunk && message && (
        <details className="mt-4 text-start text-xs text-ink-muted">
          <summary className="cursor-pointer">{t.details}</summary>
          <pre dir="ltr" className="mt-2 overflow-x-auto whitespace-pre-wrap break-words">{message}</pre>
        </details>
      )}
    </div>
  );
}

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the pathname) clears a caught error. */
  resetKey?: string;
}

interface State {
  error: unknown;
  hasError: boolean;
}

/** Catches render / lazy-chunk errors in routed page content. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.reset();
  }

  reset = () => this.setState({ error: null, hasError: false });

  render() {
    if (this.state.hasError) return <ErrorCard error={this.state.error} onReset={this.reset} />;
    return this.props.children;
  }
}
