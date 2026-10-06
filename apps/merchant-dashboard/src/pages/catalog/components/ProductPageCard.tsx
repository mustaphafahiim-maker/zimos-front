import type { ReactNode } from "react";
import { Card, CardContent } from "@store-builder/ui";

/**
 * The product page's card: the same title, description and padding as the
 * neighbouring sections (VariantsSection, OffersSection), for the cards added
 * by handoff 195/198 (pre-orders, purchase limits).
 */
export function ProductPageCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4">
          <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
          <p className="text-sm text-ink-soft">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
