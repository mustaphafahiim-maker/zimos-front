"use client";

import type { ComponentType, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** Router-agnostic link: apps pass react-router's `Link`; defaults to a plain anchor. */
export type LinkComponent = ComponentType<{ to: string; className?: string; children?: ReactNode }>;

export const AnchorLink: LinkComponent = ({ to, className, children }) => (
  <a href={to} className={className}>
    {children}
  </a>
);

export interface PageHeaderProps {
  title: string;
  /** Small muted text after the title, e.g. a product code "#482910573". */
  titleMeta?: string;
  /** Rendered on the title line, after the title and any `titleMeta`. */
  titleBadge?: ReactNode;
  description?: string;
  /** Renders a back link (arrow flips in RTL) above the title. */
  back?: { to: string; label: string };
  actions?: ReactNode;
  linkComponent?: LinkComponent;
}

export function PageHeader({
  title,
  titleMeta,
  titleBadge,
  description,
  back,
  actions,
  linkComponent: LinkEl = AnchorLink,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {back && (
        <LinkEl
          to={back.to}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {back.label}
        </LinkEl>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {title}
            {titleMeta && (
              <span className="ms-2 align-middle text-base font-normal text-ink-muted">· {titleMeta}</span>
            )}
            {titleBadge && <span className="ms-2 inline-flex align-middle">{titleBadge}</span>}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
