import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Rss, BellRing, Link2, Mail, Truck, DoorOpen, Layers, PackagePlus, Shuffle, Sparkles, Tag, Gift } from "lucide-react";
import { Card } from "@store-builder/ui";
import { offersSummaryGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { fmt } from "@/i18n/LocaleContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { AppOffNotice } from "@/components/AppOffNotice";

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
    rules: "Minimum order and free shipping",
    rulesHint: "A floor under small orders, and a bar that shows what is left for free shipping.",
    freeGifts: "Free gifts",
    freeGiftsHint: "A gift added at no charge when the order reaches an amount or has a product.",
    social: "Sales notifications",
    socialHint: "“Ahmed from Mansoura bought this” — from real orders only.",
    newsletter: "Newsletter sign-up",
    newsletterHint: "Collect mobile numbers from visitors who want to hear from you.",
    referrals: "Referral links",
    referralsHint: "A link per marketer, and the orders each one brought.",
    feed: "Product feed",
    feedHint: "A catalog link for Meta, Google, TikTok and Snapchat, and the Google Merchant checklist.",
    period: "Numbers are for the last {days} days.",
    statBundles: "{orders} orders · customers saved {amount}",
    statBumps: "{count} sold · {amount}",
    statUpsells: "{count} accepted · {amount}",
    statRules: "{count} active",
    statDiscounts: "{count} uses · {amount} off",
    statSubscribers: "{count} new subscribers",
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
    rules: "الحد الأدنى للطلب والشحن المجاني",
    rulesHint: "حد أدنى للأوردرات الصغيرة، وشريط يوضح المتبقي للشحن المجاني.",
    freeGifts: "هدايا مع الأوردر",
    freeGiftsHint: "هدية بتتضاف ببلاش لما الأوردر يوصل لمبلغ معيّن أو يكون فيه منتج معيّن.",
    social: "إشعارات المبيعات",
    socialHint: "«أحمد من المنصورة اشترى هذا» — من أوردرات حقيقية فقط.",
    newsletter: "الاشتراك في النشرة",
    newsletterHint: "اجمع أرقام الزوار الذين يريدون متابعتك.",
    referrals: "روابط الإحالة",
    referralsHint: "رابط لكل مسوّق، والأوردرات التي جاءت منه.",
    feed: "ملف المنتجات",
    feedHint: "رابط كتالوج لـ Meta وGoogle وTikTok وSnapchat، وقائمة فحص Google Merchant.",
    period: "الأرقام لآخر {days} يوم.",
    statBundles: "{orders} أوردر · وفّر العملاء {amount}",
    statBumps: "{count} مباعة · {amount}",
    statUpsells: "{count} مقبولة · {amount}",
    statRules: "{count} مفعّلة",
    statDiscounts: "{count} استخدام · خصم {amount}",
    statSubscribers: "{count} مشترك جديد",
    discounts: "أكواد الخصم",
    discountsHint: "الكوبونات والخصومات التلقائية.",
  },
} satisfies Messages;

export interface OfferTool {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
  /** The tool's own numbers for the period, when it has any. */
  stat?: string;
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
          {tool.stat && <span className="mt-1 block text-sm font-medium text-primary">{tool.stat}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-soft rtl:rotate-180" aria-hidden />
      </Card>
    </Link>
  );
}

export function OffersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // Each tool's numbers; the cards work without them while they load or if they fail.
  const summary = useAsync(() => offersSummaryGet(apiClient, workspaceId, 30), [workspaceId]).data;
  const s = summary;
  const tools: OfferTool[] = [
    {
      to: "/offers/bundles",
      icon: <Layers />,
      title: t.bundles,
      hint: t.bundlesHint,
      stat: s && s.bundles.orders > 0 ? fmt(t.statBundles, { orders: s.bundles.orders, amount: formatMoney(s.bundles.savedAmount) }) : undefined,
    },
    {
      to: "/offers/order-bumps",
      icon: <PackagePlus />,
      title: t.bumps,
      hint: t.bumpsHint,
      stat: s && s.bumps.sold > 0 ? fmt(t.statBumps, { count: s.bumps.sold, amount: formatMoney(s.bumps.revenue) }) : undefined,
    },
    {
      to: "/offers/cross-sell",
      icon: <Shuffle />,
      title: t.crossSell,
      hint: t.crossSellHint,
      stat: s && s.crossSell.active > 0 ? fmt(t.statRules, { count: s.crossSell.active }) : undefined,
    },
    {
      to: "/offers/upsells",
      icon: <Sparkles />,
      title: t.upsells,
      hint: t.upsellsHint,
      stat: s && s.upsells.accepted > 0 ? fmt(t.statUpsells, { count: s.upsells.accepted, amount: formatMoney(s.upsells.revenue) }) : undefined,
    },
    { to: "/offers/exit-popup", icon: <DoorOpen />, title: t.exit, hint: t.exitHint },
    { to: "/offers/order-rules", icon: <Truck />, title: t.rules, hint: t.rulesHint },
    { to: "/offers/free-gifts", icon: <Gift />, title: t.freeGifts, hint: t.freeGiftsHint },
    { to: "/offers/social-proof", icon: <BellRing />, title: t.social, hint: t.socialHint },
    {
      to: "/offers/newsletter",
      icon: <Mail />,
      title: t.newsletter,
      hint: t.newsletterHint,
      stat: s && s.newsletter.subscribers > 0 ? fmt(t.statSubscribers, { count: s.newsletter.subscribers }) : undefined,
    },
    { to: "/offers/referrals", icon: <Link2 />, title: t.referrals, hint: t.referralsHint },
    { to: "/offers/feed", icon: <Rss />, title: t.feed, hint: t.feedHint },
    {
      to: "/discounts",
      icon: <Tag />,
      title: t.discounts,
      hint: t.discountsHint,
      stat: s && s.discounts.redemptions > 0 ? fmt(t.statDiscounts, { count: s.discounts.redemptions, amount: formatMoney(s.discounts.amount) }) : undefined,
    },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader
        tutorial="offers" title={t.title} description={summary ? `${t.description} ${fmt(t.period, { days: summary.days })}` : t.description} />
      <AppOffNotice app="offers" />
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <OfferToolCard key={tool.to} tool={tool} />
        ))}
      </div>
    </div>
  );
}
