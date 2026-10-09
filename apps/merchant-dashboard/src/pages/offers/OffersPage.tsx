import {
  IconBellRinging,
  IconCourier,
  IconDoor,
  IconEmail,
  IconGift,
  IconLayers,
  IconLink,
  IconProductAdd,
  IconRss,
  IconSale,
  IconSchedule,
  IconShuffle,
  IconSparkle,
  IconSpinner,
  IconTag,
  IconTicket,
} from "@/components/icons";
import { offersSummaryGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AppOffNotice } from "@/components/AppOffNotice";
import { OffersHub } from "./hub/OffersHub";
import { OfferTools, type OfferToolGroup } from "./hub/OfferTools";

// Other screens keep importing the card from here.
export { OfferToolCard, type OfferTool } from "./hub/OfferToolCard";

/**
 * The offers tab of «العروض والخصومات» (SPEC §10.11): every tool that raises
 * the value of an order or brings a customer, grouped by what it is for. Each
 * card opens the tool's own screen; its numbers for the last 30 days and how
 * many of its rules are running come from one summary call, and the cards work
 * without them while it loads or if it fails.
 */

const STRINGS = {
  en: {
    groupValue: "Raise the order's value",
    groupUrgency: "Give a reason to buy now",
    groupRules: "Rules and prices",
    groupReach: "Bring customers",
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
    scheduledSales: "Scheduled sales",
    scheduledSalesHint: "A sale that starts and ends by itself: prices drop at the start and come back at the end.",
    cartOffers: "Cart offers",
    cartOffersHint: "A product at a lower price in the cart, when it has a certain product or reaches an amount.",
    spinWheel: "Spin to win",
    spinWheelHint: "A popup wheel: the visitor gives their mobile number and spins for a discount code.",
    social: "Sales notifications",
    socialHint: "“Ahmed from Mansoura bought this” — from real orders only.",
    newsletter: "Newsletter sign-up",
    newsletterHint: "Collect mobile numbers from visitors who want to hear from you.",
    referrals: "Referral links",
    referralsHint: "A link per marketer, and the orders each one brought.",
    feed: "Product feed",
    feedHint: "A catalog link for Meta, Google, TikTok and Snapchat, and the Google Merchant checklist.",
    priceLists: "Price lists",
    priceListsHint: "Wholesale prices: lower prices for customers who carry a tag, once they sign in.",
    discounts: "Discount codes",
    discountsHint: "Coupons and automatic discounts.",
    period: "Numbers are for the last {days} days.",
    statBundles: "{orders} orders · customers saved {amount}",
    statBumps: "{count} sold · {amount}",
    statUpsells: "{count} accepted · {amount}",
    statDiscounts: "{count} uses · {amount} off",
    statSubscribers: "{count} new subscribers",
    running_one: "1 running",
    running_other: "{n} running",
  },
  ar: {
    groupValue: "زوّد قيمة الأوردر",
    groupUrgency: "حفّز الشراء",
    groupRules: "قواعد وأسعار",
    groupReach: "جيب عملاء",
    bundles: "الباقات",
    bundlesHint: "اشتري أكتر وادفع أقل في القطعة — باقة واحدة لمنتجات كتير.",
    bumps: "إضافات الطلب",
    bumpsHint: "مربع اختيار في فورم الأوردر: ضيف ده على أوردرك.",
    crossSell: "منتجات مقترحة",
    crossSellHint: "اقترح منتجات تمشي مع اللي في السلة.",
    upsells: "عرض بعد الشراء",
    upsellsHint: "عرض كمان في صفحة الشكر، بيتضاف بضغطة واحدة.",
    exit: "نافذة الخروج",
    exitHint: "عرض أخير بكوبون للزائر اللي ماشي.",
    rules: "الحد الأدنى للطلب والشحن المجاني",
    rulesHint: "حد أدنى للأوردرات الصغيرة، وشريط يقول فاضل كام على الشحن المجاني.",
    freeGifts: "هدايا مع الأوردر",
    freeGiftsHint: "هدية بتتضاف ببلاش لما الأوردر يوصل لمبلغ معيّن أو يكون فيه منتج معيّن.",
    scheduledSales: "التخفيضات المجدولة",
    scheduledSalesHint: "تخفيض بيبدأ ويخلص لوحده: الأسعار بتنزل في البداية وبترجع في النهاية.",
    cartOffers: "عروض السلة",
    cartOffersHint: "منتج بسعر أقل في السلة، لما يكون فيها منتج معيّن أو توصل لمبلغ معيّن.",
    spinWheel: "عجلة الحظ",
    spinWheelHint: "نافذة فيها عجلة: الزائر يكتب رقم موبايله ويلف على كود خصم.",
    social: "إشعارات المبيعات",
    socialHint: "«أحمد من المنصورة اشترى ده» — من أوردرات حقيقية بس.",
    newsletter: "الاشتراك في النشرة",
    newsletterHint: "اجمع أرقام الزوار اللي عايزين يتابعوك.",
    referrals: "روابط الإحالة",
    referralsHint: "لينك لكل مسوّق، والأوردرات اللي جت منه.",
    feed: "ملف المنتجات",
    feedHint: "لينك كتالوج لـ Meta وGoogle وTikTok وSnapchat، وقايمة فحص Google Merchant.",
    priceLists: "قوايم الأسعار",
    priceListsHint: "أسعار الجملة: أسعار أقل للعملاء اللي عندهم وسم معيّن، بعد ما يسجّلوا دخول.",
    discounts: "أكواد الخصم",
    discountsHint: "الكوبونات والخصومات التلقائية.",
    period: "الأرقام لآخر {days} يوم.",
    statBundles: "{orders} أوردر · العملاء وفّروا {amount}",
    statBumps: "{count} اتباعت · {amount}",
    statUpsells: "{count} اتقبلت · {amount}",
    statDiscounts: "{count} استخدام · خصم {amount}",
    statSubscribers: "{count} مشترك جديد",
    running_one: "واحد شغّال",
    running_two: "اتنين شغّالين",
    running_few: "{n} شغّالين",
    running_other: "{n} شغّال",
  },
} satisfies Messages;

export function OffersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // Each tool's numbers; the cards work without them while they load or if they fail.
  // Kept for the session, so coming back to the hub shows them at once.
  const s = useCachedAsync(`offers-summary:${workspaceId}`, () => offersSummaryGet(apiClient, workspaceId, 30), [workspaceId]).data;

  // «٣ شغّالين»: only when the summary knows, and only above zero.
  const running = (count: number | undefined) => (count !== undefined && count > 0 ? pluralOf(t, "running", count) : undefined);

  const groups: OfferToolGroup[] = [
    {
      id: "value",
      title: t.groupValue,
      tools: [
        {
          to: "/offers/bundles",
          icon: <IconLayers />,
          title: t.bundles,
          hint: t.bundlesHint,
          state: running(s?.bundles.active),
          stat: s && s.bundles.orders > 0 ? fmt(t.statBundles, { orders: s.bundles.orders, amount: formatMoney(s.bundles.savedAmount) }) : undefined,
        },
        {
          to: "/offers/order-bumps",
          icon: <IconProductAdd />,
          title: t.bumps,
          hint: t.bumpsHint,
          state: running(s?.bumps.active),
          stat: s && s.bumps.sold > 0 ? fmt(t.statBumps, { count: s.bumps.sold, amount: formatMoney(s.bumps.revenue) }) : undefined,
        },
        {
          to: "/offers/upsells",
          icon: <IconSparkle />,
          title: t.upsells,
          hint: t.upsellsHint,
          state: running(s?.upsells.active),
          stat: s && s.upsells.accepted > 0 ? fmt(t.statUpsells, { count: s.upsells.accepted, amount: formatMoney(s.upsells.revenue) }) : undefined,
        },
        { to: "/offers/cross-sell", icon: <IconShuffle />, title: t.crossSell, hint: t.crossSellHint, state: running(s?.crossSell.active) },
        { to: "/offers/cart-offers", icon: <IconSale />, title: t.cartOffers, hint: t.cartOffersHint },
        { to: "/offers/free-gifts", icon: <IconGift />, title: t.freeGifts, hint: t.freeGiftsHint },
      ],
    },
    {
      id: "urgency",
      title: t.groupUrgency,
      tools: [
        { to: "/offers/scheduled-sales", icon: <IconSchedule />, title: t.scheduledSales, hint: t.scheduledSalesHint },
        { to: "/offers/exit-popup", icon: <IconDoor />, title: t.exit, hint: t.exitHint },
        { to: "/offers/spin-wheel", icon: <IconSpinner />, title: t.spinWheel, hint: t.spinWheelHint },
        { to: "/offers/social-proof", icon: <IconBellRinging />, title: t.social, hint: t.socialHint },
      ],
    },
    {
      id: "rules",
      title: t.groupRules,
      tools: [
        { to: "/offers/order-rules", icon: <IconCourier />, title: t.rules, hint: t.rulesHint },
        { to: "/offers/price-lists", icon: <IconTag />, title: t.priceLists, hint: t.priceListsHint },
        {
          to: "/discounts",
          icon: <IconTicket />,
          title: t.discounts,
          hint: t.discountsHint,
          state: running(s?.discounts.active),
          stat:
            s && s.discounts.redemptions > 0
              ? fmt(t.statDiscounts, { count: s.discounts.redemptions, amount: formatMoney(s.discounts.amount) })
              : undefined,
        },
      ],
    },
    {
      id: "reach",
      title: t.groupReach,
      tools: [
        {
          to: "/offers/newsletter",
          icon: <IconEmail />,
          title: t.newsletter,
          hint: t.newsletterHint,
          stat: s && s.newsletter.subscribers > 0 ? fmt(t.statSubscribers, { count: s.newsletter.subscribers }) : undefined,
        },
        { to: "/offers/referrals", icon: <IconLink />, title: t.referrals, hint: t.referralsHint },
        { to: "/offers/feed", icon: <IconRss />, title: t.feed, hint: t.feedHint },
      ],
    },
  ];

  // The period is named only when a card shows a number it applies to.
  const hasStats = groups.some((group) => group.tools.some((tool) => tool.stat));

  return (
    <OffersHub tab="offers" tutorial="offers">
      <AppOffNotice app="offers" />
      <OfferTools groups={groups} note={s && hasStats ? fmt(t.period, { days: s.days }) : undefined} />
    </OffersHub>
  );
}
