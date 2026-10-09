import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { TutorialLink } from "@/components/Education";
import {
  IconClock,
  IconGlobe,
  IconLayers,
  IconMapPinned,
  IconPercent,
  IconPlug,
  IconScale,
  IconShipping,
  IconSliders,
  IconStore,
  type IconComponent,
} from "@/components/icons";
import { SettingsLayout, SettingsPane, type SettingsSectionDef, type SettingsTone } from "@/components/settings";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DeliverySlotsSection } from "@/pages/deliverySlots/DeliverySlotsSection";
import { StorePickupSection } from "@/pages/pickup/StorePickupSection";
import { AddressLookupSection } from "./AddressLookupSection";
import { CarrierConnectionsSection } from "./CarrierConnectionsSection";
import { DeliveryTimesSection } from "./DeliveryTimesSection";
import { ShippingOptionsSection } from "./ShippingOptionsSection";
import { ShippingProfilesSection } from "./ShippingProfilesSection";
import { ShippingSettingsSection } from "./ShippingSettingsSection";
import { isShippingSection, useShippingSection, type ShippingSection } from "./ShippingTabs";
import { StorePlacesSection } from "./StorePlacesSection";
import { WeightTiersSection } from "./WeightTiersSection";
import { TaxSection } from "./sections/TaxSection";
import { ZonesSection } from "./sections/ZonesSection";

const STRINGS = {
  en: {
    title: "Shipping & Tax",
    description: "What a customer pays for shipping, where and when you deliver, who carries it, and tax at checkout.",
    search: "Search shipping…",
    groupPrices: "Prices",
    groupDelivery: "Delivery",
    groupTax: "Tax",
    rates: "Shipping prices",
    ratesHint: "The default price and each governorate's",
    ratesLead: "What a customer pays for shipping. The checkout shows exactly this once they pick their governorate.",
    places: "Places",
    placesHint: "Your cities and areas, each with its price",
    groups: "Shipping groups",
    groupsHint: "Products with a shipping price of their own",
    weight: "Weight tiers",
    weightHint: "Price shipping by the order's weight",
    zones: "Shipping zones",
    zonesHint: "Countries and rates: flat, by weight, by quantity",
    delivery: "Delivery times",
    deliveryHint: "How long an order takes, and slots to choose",
    pickup: "Store pickup",
    pickupHint: "Customers collect their order from you",
    pickupLead: "Let customers collect their order from one of your places instead of having it delivered.",
    options: "Shipping options",
    optionsHint: "Standard, express… the customer chooses",
    carriers: "Shipping companies",
    carriersHint: "Connect your account and book the courier",
    carriersLead: "Connect a courier account to book deliveries, print labels and get status updates from the order page.",
    taxes: "Taxes",
    taxesHint: "Tax at checkout and its rates",
  },
  ar: {
    title: "الشحن والضرائب",
    description: "العميل هيدفع كام في الشحن، بتوصّل فين وإمتى، مين اللي بيشحن، والضريبة في صفحة الدفع.",
    search: "دوّر في الشحن…",
    groupPrices: "الأسعار",
    groupDelivery: "التوصيل",
    groupTax: "الضرائب",
    rates: "أسعار الشحن",
    ratesHint: "السعر الأساسي وسعر كل محافظة",
    ratesLead: "اللي العميل بيدفعه في الشحن. صفحة الدفع بتعرض المبلغ ده بالظبط أول ما يختار محافظته.",
    places: "المناطق",
    placesHint: "مدنك ومناطقك وسعر كل واحدة",
    groups: "مجموعات الشحن",
    groupsHint: "منتجات ليها سعر شحن لوحدها",
    weight: "شرائح الوزن",
    weightHint: "سعّر الشحن على حسب وزن الأوردر",
    zones: "مناطق الشحن",
    zonesHint: "دول وأسعارها: ثابت، بالوزن، بالكمية",
    delivery: "مواعيد التوصيل",
    deliveryHint: "الأوردر بيوصل في كام يوم، ومواعيد العميل يختار منها",
    pickup: "الاستلام من الفرع",
    pickupHint: "العميل يستلم أوردره من عندك",
    pickupLead: "خلّي العميل يستلم أوردره من مكان من أماكنك بدل ما يتوصّل له.",
    options: "خيارات الشحن",
    optionsHint: "عادي، سريع… والعميل يختار",
    carriers: "شركات الشحن",
    carriersHint: "اربط حسابك واحجز المندوب من الأوردر",
    carriersLead: "اربط حساب شركة الشحن عشان تحجز المندوب وتطبع البوالص وتتابع الحالة من صفحة الأوردر.",
    taxes: "الضرائب",
    taxesHint: "الضريبة في صفحة الدفع ونِسَبها",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** How each section looks in the list and at the head of its pane. The words for the search are in both languages. */
const SECTION_LOOK: Record<
  ShippingSection,
  { icon: IconComponent; tone: SettingsTone; group: "groupPrices" | "groupDelivery" | "groupTax"; keywords: string[] }
> = {
  rates: {
    icon: IconShipping,
    tone: "blue",
    group: "groupPrices",
    keywords: ["محافظات", "محافظة", "سعر", "شحن مجاني", "السعر الأساسي", "الافتراضي", "governorates", "price", "default", "free shipping", "rates", "courier"],
  },
  places: {
    icon: IconMapPinned,
    tone: "teal",
    group: "groupPrices",
    keywords: ["مدن", "مدينة", "أحياء", "حي", "عنوان", "اقتراحات العنوان", "جوجل", "cities", "areas", "regions", "address", "google maps", "import"],
  },
  groups: {
    icon: IconLayers,
    tone: "purple",
    group: "groupPrices",
    keywords: ["مجموعة", "منتجات تقيلة", "مسار البيع", "عملة", "groups", "profiles", "heavy", "products", "funnel", "currency"],
  },
  weight: {
    icon: IconScale,
    tone: "orange",
    group: "groupPrices",
    keywords: ["وزن", "كيلو", "شريحة", "تسعير", "weight", "kg", "tiers", "bands", "pricing mode"],
  },
  zones: {
    icon: IconGlobe,
    tone: "green",
    group: "groupPrices",
    keywords: ["دول", "دولة", "شحن دولي", "منطقة", "سعر ثابت", "countries", "zones", "international", "flat", "quantity", "order value"],
  },
  delivery: {
    icon: IconClock,
    tone: "pink",
    group: "groupDelivery",
    keywords: ["مدة", "أيام", "ميعاد", "مواعيد", "إجازة", "فترات", "days", "estimate", "slots", "schedule", "cutoff", "closed days"],
  },
  pickup: {
    icon: IconStore,
    tone: "orange",
    group: "groupDelivery",
    keywords: ["استلام", "فرع", "مخزن", "pickup", "click and collect", "branch", "location"],
  },
  options: {
    icon: IconSliders,
    tone: "gray",
    group: "groupDelivery",
    keywords: ["سريع", "عادي", "طريقة التوصيل", "express", "standard", "methods", "options"],
  },
  carriers: {
    icon: IconPlug,
    tone: "green",
    group: "groupDelivery",
    keywords: ["مندوب", "بوسطة", "ربط", "مفتاح", "بوليصة", "courier", "carrier", "bosta", "api key", "connect", "label", "waybill", "booking", "areas"],
  },
  taxes: {
    icon: IconPercent,
    tone: "red",
    group: "groupTax",
    keywords: ["ضريبة", "قيمة مضافة", "نسبة", "tax", "vat", "rate"],
  },
};

/** The order of the list. */
const ORDER: readonly ShippingSection[] = ["rates", "places", "groups", "weight", "zones", "delivery", "pickup", "options", "carriers", "taxes"];

export function ShippingTaxPage() {
  // Key the body on the workspace so all workspace-seeded state (every section's
  // form, the tax switch) re-initialises on a store switch, mirroring how
  // SettingsPage keys its sections. The guard around it is what a switch of
  // section asks before dropping an unsaved form.
  const workspaceId = useWorkspaceId();
  return (
    <UnsavedGuardProvider>
      <ShippingTaxBody key={workspaceId} />
    </UnsavedGuardProvider>
  );
}

function ShippingTaxBody() {
  const tr = useT(STRINGS);
  const { section: urlSection, select } = useShippingSection();
  // The section on screen. It follows the URL — but with an unsaved form open,
  // only once the merchant has said so, since switching unmounts the form.
  const [shown, setShown] = useState<ShippingSection | null>(urlSection);
  const { dirty, confirmLeave } = useUnsavedGuard();
  // A change the layout already asked about (its `canLeave`): the URL may follow without a second question.
  const approved = useRef<{ to: ShippingSection | null } | null>(null);

  function onSelect(id: string | null) {
    const next = isShippingSection(id) ? id : null;
    if (next !== shown) approved.current = { to: next };
    select(next);
  }

  // The URL can change without the list (a link into ?tab=, back / forward).
  // Nothing unsaved, or just approved above: follow it. Otherwise ask, and on
  // «كمّل تعديل» put the URL back where the screen is. `select` is remade every
  // render but always does the same thing, so it is not a dependency.
  useEffect(() => {
    if (urlSection === shown) return;
    if (!dirty || (approved.current !== null && approved.current.to === urlSection)) {
      approved.current = null;
      setShown(urlSection);
      return;
    }
    let stale = false;
    void confirmLeave().then((leave) => {
      if (stale) return;
      if (leave) setShown(urlSection);
      else select(shown);
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSection, shown, dirty, confirmLeave]);

  const sections = useMemo<SettingsSectionDef[]>(
    () =>
      ORDER.map((id) => {
        const look = SECTION_LOOK[id];
        return {
          id,
          label: tr[id],
          description: tr[`${id}Hint`],
          icon: look.icon,
          tone: look.tone,
          group: tr[look.group],
          keywords: look.keywords,
        };
      }),
    [tr]
  );

  return (
    <SettingsLayout
      title={tr.title}
      sections={sections}
      current={shown}
      onSelect={onSelect}
      canLeave={confirmLeave}
      searchPlaceholder={tr.search}
      // On a phone the list is the page: say what the page is for.
      listHeader={<p className="px-1 text-sm leading-6 text-ink-soft lg:px-2 lg:text-[13px] lg:leading-5">{tr.description}</p>}
      listFooter={<TutorialLink topic="shipping" />}
    >
      {shown !== null && <ShippingPane section={shown} tr={tr} />}
    </SettingsLayout>
  );
}

/** One section in the pane: its head (tile, name, one line) and its own content, which loads and saves itself. */
function ShippingPane({ section, tr }: { section: ShippingSection; tr: Strings }) {
  const { currentWorkspace, refresh: refreshWorkspace } = useWorkspace();
  const look = SECTION_LOOK[section];
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  let lead: string | undefined;
  let body: ReactNode = null;
  switch (section) {
    case "rates":
      lead = tr.ratesLead;
      body = <ShippingSettingsSection onSaved={refreshWorkspace} />;
      break;
    case "places":
      body = (
        <>
          {/* The store's own regions → cities → areas and their prices (handoff 163/164). */}
          <StorePlacesSection />
          {/* Address suggestions at checkout: off, the places list or Google Maps (handoff 184). */}
          <AddressLookupSection />
        </>
      );
      break;
    case "groups":
      body = <ShippingProfilesSection />;
      break;
    case "weight":
      body = <WeightTiersPane currency={currency} />;
      break;
    case "zones":
      body = <ZonesSection />;
      break;
    case "delivery":
      body = (
        <>
          <DeliveryTimesSection />
          {/* The day and time slots a shopper chooses from at checkout (handoff 221). */}
          <DeliverySlotsSection />
        </>
      );
      break;
    case "pickup":
      lead = tr.pickupLead;
      // Click and collect (handoff 225). The section draws a heading of its own; the pane's head already
      // says it, so its title and description are hidden here and its «open the queue» button stays.
      body = (
        <div className="min-w-0 [&>section>div:first-child>div:first-child]:hidden">
          <StorePickupSection />
        </div>
      );
      break;
    case "options":
      body = <ShippingOptionsSection currency={currency} />;
      break;
    case "carriers":
      lead = tr.carriersLead;
      body = <CarrierConnectionsSection />;
      break;
    case "taxes":
      lead = tr.taxesHint;
      body = <TaxSection onSaved={refreshWorkspace} />;
      break;
  }

  return (
    <SettingsPane title={tr[section]} description={lead} icon={look.icon} tone={look.tone}>
      {body}
    </SettingsPane>
  );
}

/** Weight tiers price each zone, so the pane reads the zones for its grid. */
function WeightTiersPane({ currency }: { currency: string }) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh: refreshWorkspace } = useWorkspace();
  const zones = useAsync(() => apiClient.listShippingZones(workspaceId), [workspaceId]);
  return (
    <WeightTiersSection
      zones={zones.data ?? []}
      workspace={currentWorkspace}
      currency={currency}
      onWorkspaceChanged={refreshWorkspace}
    />
  );
}
