import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, DoorOpen, Layers, PackagePlus, Shuffle, Sparkles, Tag } from "lucide-react";
import { Card } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";

/**
 * The offers hub (SPEC §10.11): one place for everything that raises the
 * value of an order. Each card opens the tool's own screen.
 */

const STRINGS = {
  en: {
    title: "Offers",
    description: "Tools that raise the value of every order.",
    bundles: "Bundles",
    bundlesHint: "Buy more, pay less per piece — one bundle for many products.",
    bumps: "Order bumps",
    bumpsHint: "A tick box on the order form: add this to your order.",
    crossSell: "Cross-sell",
    crossSellHint: "Suggest products that go with what is in the cart.",
    upsells: "Post-purchase upsell",
    upsellsHint: "One more offer on the thank-you page, added with one tap.",
    exit: "Exit popup",
    exitHint: "A last offer with a coupon for a visitor who is leaving.",
    discounts: "Discount codes",
    discountsHint: "Coupons and automatic discounts.",
  },
  ar: {
    title: "العروض",
    description: "أدوات ترفع قيمة كل أوردر.",
    bundles: "الباقات",
    bundlesHint: "اشترِ أكثر وادفع أقل للقطعة — باقة واحدة لمنتجات كثيرة.",
    bumps: "إضافات الطلب",
    bumpsHint: "مربع اختيار في فورم الطلب: أضف هذا إلى طلبك.",
    crossSell: "منتجات مقترحة",
    crossSellHint: "اقترح منتجات تناسب ما في السلة.",
    upsells: "عرض بعد الشراء",
    upsellsHint: "عرض إضافي في صفحة الشكر، يُضاف بضغطة واحدة.",
    exit: "نافذة الخروج",
    exitHint: "عرض أخير بكوبون لزائر يغادر.",
    discounts: "أكواد الخصم",
    discountsHint: "الكوبونات والخصومات التلقائية.",
  },
} satisfies Messages;

export interface OfferTool {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
}

export function OfferToolCard({ tool }: { tool: OfferTool }) {
  return (
    <Link to={tool.to} className="group block rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-primary">
      <Card className="flex h-full items-center gap-4 p-5 transition-colors group-hover:border-primary">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary [&>svg]:size-5">
          {tool.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{tool.title}</span>
          <span className="block text-sm text-ink-soft">{tool.hint}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-soft rtl:rotate-180" aria-hidden />
      </Card>
    </Link>
  );
}

export function OffersPage() {
  const t = useT(STRINGS);
  const tools: OfferTool[] = [
    { to: "/offers/bundles", icon: <Layers />, title: t.bundles, hint: t.bundlesHint },
    { to: "/offers/order-bumps", icon: <PackagePlus />, title: t.bumps, hint: t.bumpsHint },
    { to: "/offers/cross-sell", icon: <Shuffle />, title: t.crossSell, hint: t.crossSellHint },
    { to: "/offers/upsells", icon: <Sparkles />, title: t.upsells, hint: t.upsellsHint },
    { to: "/offers/exit-popup", icon: <DoorOpen />, title: t.exit, hint: t.exitHint },
    { to: "/discounts", icon: <Tag />, title: t.discounts, hint: t.discountsHint },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <OfferToolCard key={tool.to} tool={tool} />
        ))}
      </div>
    </div>
  );
}
