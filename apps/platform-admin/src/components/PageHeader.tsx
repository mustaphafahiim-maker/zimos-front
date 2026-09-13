import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  titleBadge?: ReactNode;
  description?: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
}

export function PageHeader({ title, titleBadge, description, back, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-ink">
            {title}
            {titleBadge}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
