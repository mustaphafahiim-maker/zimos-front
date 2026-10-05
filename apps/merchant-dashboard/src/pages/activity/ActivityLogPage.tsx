import { useState } from "react";
import { History } from "lucide-react";
import { activityLogList, type ActivityLogEntry } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";

/**
 * Activity log (SPEC §17.2): who did what in the store and when, newest
 * first, from the audit trail every change already writes.
 */

const STRINGS = {
  en: {
    title: "Activity log",
    description: "Every change made in this store: who made it and when.",
    area: "Area",
    person: "Person",
    period: "Period",
    all: "Everything",
    everyone: "Everyone",
    anytime: "Any time",
    today: "Today",
    week: "Last 7 days",
    month: "Last 30 days",
    emptyTitle: "Nothing recorded",
    emptyBody: "No change matches these filters.",
    system: "System",
    details: "Details",
    before: "Before",
    after: "After",
    "area.order": "Orders",
    "area.shipment": "Shipments",
    "area.product": "Products",
    "area.customer": "Customers",
    "area.discount": "Discounts",
    "area.membership": "Team",
    "area.role": "Roles",
    "area.workspace": "Store settings",
    "area.funnel": "Funnels",
    "area.website": "Store design",
    "area.webhook": "Webhooks",
    "area.api_key": "API keys",
    "area.app": "Apps",
    "area.support": "Support access",
    "area.automation": "Automations",
  },
  ar: {
    title: "سجل النشاط",
    description: "كل تغيير اتعمل في المتجر: مين عمله وإمتى.",
    area: "القسم",
    person: "الشخص",
    period: "الفترة",
    all: "الكل",
    everyone: "الكل",
    anytime: "أي وقت",
    today: "النهارده",
    week: "آخر ٧ أيام",
    month: "آخر ٣٠ يوم",
    emptyTitle: "مفيش حاجة مسجّلة",
    emptyBody: "مفيش تغيير مطابق للفلاتر دي.",
    system: "النظام",
    details: "التفاصيل",
    before: "قبل",
    after: "بعد",
    "area.order": "الطلبات",
    "area.shipment": "الشحنات",
    "area.product": "المنتجات",
    "area.customer": "العملاء",
    "area.discount": "الخصومات",
    "area.membership": "الفريق",
    "area.role": "الأدوار",
    "area.workspace": "إعدادات المتجر",
    "area.funnel": "مسارات البيع",
    "area.website": "تصميم المتجر",
    "area.webhook": "الـ Webhooks",
    "area.api_key": "مفاتيح الـ API",
    "area.app": "التطبيقات",
    "area.support": "إذن الدعم",
    "area.automation": "الأتمتة",
  },
} satisfies Messages;

const AREAS = ["order", "shipment", "product", "customer", "discount", "membership", "role", "workspace", "funnel", "website", "webhook", "api_key", "app", "support", "automation"];
const PAGE = 40;
type Period = "any" | "today" | "week" | "month";

function fromOf(period: Period): string | undefined {
  if (period === "any") return undefined;
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return new Date(now.getTime() - (period === "week" ? 7 : 30) * 86400000).toISOString();
}

/** "order.status_change" → "Order · status change" */
const readable = (action: string) => {
  const [head, ...rest] = action.split(".");
  const words = (text: string) => text.replace(/_/g, " ");
  return rest.length ? `${words(head)[0].toUpperCase()}${words(head).slice(1)} · ${words(rest.join(" "))}` : words(action);
};

/**
 * Arabic names for the audit codes the backend writes ("entity.verb"): the
 * entity by the code's first part, the verb by the rest. English stays as
 * `readable` builds it, and a part missing here keeps those English words — a
 * new backend action still shows, untranslated until it is added.
 */
const ENTITIES_AR: Record<string, string> = {
  // Done by the Zimos team on this store
  admin: "إدارة المنصة",
  // Orders
  order: "الطلب",
  order_email: "إيميلات الطلبات",
  order_rules: "قواعد الطلبات",
  confirmation_task: "تأكيد الطلب",
  checkout_session: "الطلب المفقود",
  shipment: "الشحنة",
  return: "المرتجع",
  settlement: "التسوية",
  blocklist: "قائمة الحظر",
  // Products
  product: "المنتج",
  variant: "المتغير",
  inventory: "المخزون",
  collection: "المجموعة",
  bundle: "الباقة",
  review: "التقييم",
  media: "مكتبة الصور",
  digital_file: "الملف الرقمي",
  digital_delivery: "تسليم المنتج الرقمي",
  digital_grant: "صلاحية التحميل",
  license_codes: "أكواد الترخيص",
  course: "الكورس",
  subscription: "الاشتراك",
  product_economics: "تكاليف المنتج",
  product_feed: "ملف المنتجات",
  // Customers
  customer: "العميل",
  contact: "جهة الاتصال",
  segment: "الشريحة",
  newsletter: "النشرة البريدية",
  form_submission: "رسالة النموذج",
  whatsapp: "واتساب",
  whatsapp_campaign: "حملة واتساب",
  // Marketing
  discount: "الخصم",
  offer: "العرض",
  upsell_rule: "عرض بعد الشراء",
  order_bump: "العرض الإضافي",
  cross_sell: "المنتجات المقترحة",
  exit_downsell: "نافذة الخروج",
  social_proof: "إشعارات المبيعات",
  automation: "الأتمتة",
  affiliate: "المسوّق بالعمولة",
  ad_spend: "الإنفاق الإعلاني",
  tracking_pixel: "البيكسل",
  tracking: "التتبع",
  ai: "الذكاء الاصطناعي",
  // Store
  workspace: "المتجر",
  website: "الموقع",
  page: "الصفحة",
  saved_section: "القسم المحفوظ",
  funnel: "مسار البيع",
  split_test: "اختبار A/B",
  geo_redirect: "التحويل حسب الدولة",
  shoppable_image: "الصورة التفاعلية",
  domain: "الدومين",
  custom_code: "الكود المخصص",
  translation: "الترجمة",
  // Money and shipping
  payment_gateway: "بوابة الدفع",
  payment_methods: "طرق الدفع",
  payment_rules: "قواعد الدفع",
  manual_transfer: "التحويل البنكي",
  saved_payment_method: "وسيلة الدفع المحفوظة",
  currencies: "العملات",
  tax_rate: "الضريبة",
  shipping: "الشحن",
  shipping_zone: "منطقة الشحن",
  shipping_rate: "سعر الشحن",
  shipping_weight_tiers: "شرائح الوزن",
  shipping_zone_tier_prices: "أسعار شرائح الوزن",
  carrier_account: "حساب شركة الشحن",
  dropship: "مورّد الدروبشيبنج",
  billing_invoice: "فاتورة الاشتراك",
  billing_payment: "دفع الاشتراك",
  // Team, access and integrations
  membership: "عضو الفريق",
  role: "الدور",
  notification_preferences: "الإشعارات",
  api_key: "مفتاح الـ API",
  webhook: "الـ Webhooks",
  webhook_endpoint: "الـ Webhook",
  app: "التطبيق",
  integration: "الربط",
  support: "إذن الدعم",
  support_ticket: "تذكرة الدعم",
};

const VERBS_AR: Record<string, string> = {
  // Any entity
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  deleted: "حذف",
  delete_permanent: "حذف نهائي",
  add: "إضافة",
  remove: "إزالة",
  save: "حفظ",
  replace: "استبدال",
  duplicate: "تكرار",
  duplicated: "تكرار",
  import: "استيراد",
  imported: "استيراد",
  export: "تصدير",
  upload: "رفع",
  sync: "مزامنة",
  publish: "نشر",
  unpublish: "إلغاء النشر",
  rollback: "رجوع لنسخة سابقة",
  share: "مشاركة",
  unshare: "إلغاء المشاركة",
  archive: "أرشفة",
  unarchive: "استرجاع من الأرشيف",
  restore: "استرجاع",
  reorder: "إعادة ترتيب",
  settings: "تعديل الإعدادات",
  settings_update: "تعديل الإعدادات",
  defaults_update: "تعديل القيم الافتراضية",
  status_change: "تغيير الحالة",
  bulk_create: "إنشاء بالجملة",
  bulk_update: "تعديل بالجملة",
  start: "بدء",
  pause: "إيقاف مؤقت",
  resume: "استئناف",
  cancel: "إلغاء",
  approve: "قبول",
  reject: "رفض",
  confirm: "تأكيد",
  activate: "تفعيل",
  deactivate: "إيقاف",
  suspend: "إيقاف",
  reactivate: "إعادة تفعيل",
  connect: "ربط",
  disconnect: "فصل",
  install: "تثبيت",
  uninstall: "إلغاء التثبيت",
  external_install: "تثبيت تطبيق خارجي",
  external_uninstall: "إلغاء تثبيت تطبيق خارجي",
  assign: "تعيين",
  unassign: "إلغاء التعيين",
  verify: "تحقق",
  test: "إرسال تجريبي",
  request: "طلب",
  apply: "تطبيق",
  reply: "رد",
  admin_reply: "رد من الدعم",
  submit: "إرسال",
  resubmit: "إعادة إرسال",
  subscribe: "اشتراك",
  renew: "تجديد",
  revoke: "إلغاء",
  deliver: "تسليم",
  refund: "استرداد",
  charge: "تحصيل مبلغ",
  payout: "صرف العمولة",
  winner: "اختيار الفائز",
  adjust: "تعديل الكمية",
  // Orders, shipments, returns
  confirmation_state_change: "تغيير حالة التأكيد",
  financial_state_change: "تغيير حالة الدفع",
  fulfillment_state_change: "تغيير حالة التنفيذ",
  items_update: "تعديل المنتجات",
  meta_update: "تعديل البيانات",
  note_add: "إضافة ملاحظة",
  note_delete: "حذف ملاحظة",
  reopen: "إعادة فتح",
  reopened_after_payment: "إعادة فتح بعد الدفع",
  blocked: "حظر",
  blocked_and_cancelled: "حظر وإلغاء",
  risk_approved: "قبول بعد المراجعة",
  switched_to_cod: "تحويل للدفع عند الاستلام",
  payment_link_create: "إنشاء رابط دفع",
  payment_received: "استلام الدفع",
  payment_expired: "انتهاء مهلة الدفع",
  refund_requested: "طلب استرداد",
  refund_failed: "فشل الاسترداد",
  upsell_accepted: "قبول عرض بعد الشراء",
  funnel_offer_merged: "دمج عرض مسار البيع في الطلب",
  funnel_offer_separate: "عرض مسار البيع كطلب مستقل",
  claim: "استلام",
  release: "إرجاع للقائمة",
  correct: "تصحيح النتيجة",
  lock_expired: "انتهاء مهلة الاستلام",
  recovery_update: "تعديل حالة الاسترجاع",
  converted: "تحوّل إلى طلب",
  restock: "إعادة إلى المخزون",
  booking_not_saved: "حجز لم يُحفظ",
  carrier_cancel_unconfirmed: "إلغاء لم تؤكده شركة الشحن",
  statement_import: "استيراد كشف",
  entry_added: "إضافة للقائمة",
  entry_removed: "إزالة من القائمة",
  push_order: "إرسال طلب",
  // Customers and messages
  reveal_sensitive: "عرض البيانات الحساسة",
  blacklist_change: "تغيير الحظر",
  address_add: "إضافة عنوان",
  address_update: "تعديل عنوان",
  "marketing_consent.withdrawn": "سحب الموافقة على التسويق",
  reported_spam: "بلاغ عن رسائل مزعجة",
  tags_set: "تعديل الوسوم",
  bulk_tag: "وسوم بالجملة",
  "conversation.assign": "تعيين محادثة",
  "quick_reply.create": "إنشاء رد سريع",
  "quick_reply.update": "تعديل رد سريع",
  "quick_reply.delete": "حذف رد سريع",
  // Products and what they sell
  add_product: "إضافة منتج",
  remove_product: "إزالة منتج",
  reorder_products: "إعادة ترتيب المنتجات",
  set_products: "تحديد المنتجات",
  billing_plan_set: "تحديد خطة الاشتراك",
  create_manual: "إضافة يدوية",
  delete_manual: "حذف يدوي",
  enroll_manual: "تسجيل طالب يدويًا",
  enrollment_revoke: "إلغاء تسجيل طالب",
  enrollment_restore: "استرجاع تسجيل طالب",
  outline_save: "حفظ المحتوى",
  // Store, funnels and tracking
  "step.create": "إضافة خطوة",
  "step.update": "تعديل خطوة",
  "step.delete": "حذف خطوة",
  "edge.create": "ربط خطوتين",
  "edge.update": "تعديل ربط الخطوات",
  "edge.delete": "حذف ربط الخطوات",
  "branding.update": "تعديل الشعار والهوية",
  ssl_check: "فحص شهادة SSL",
  pricing_mode: "تغيير طريقة التسعير",
  rates_refresh: "تحديث أسعار الصرف",
  test_event: "إرسال حدث تجريبي",
  "purchase_timing.update": "تعديل توقيت حدث الشراء",
  "server_pixels.connect": "ربط أحداث السيرفر",
  "server_pixels.disconnect": "فصل أحداث السيرفر",
  "whatsapp.connect": "ربط واتساب",
  "whatsapp.disconnect": "فصل واتساب",
  // Team and access
  invite: "دعوة",
  invite_resend: "إعادة إرسال الدعوة",
  role_change: "تغيير الدور",
  shortcuts_set: "تعديل الاختصارات",
  rotate_secret: "تغيير مفتاح التوقيع",
  auto_disable: "إيقاف تلقائي",
  resend_orders: "إعادة إرسال الطلبات",
  access_grant: "منح",
  access_revoke: "إنهاء",
  access_used: "استخدام",
  // The store's own subscription
  trial_start: "بدء الفترة التجريبية",
  draft_released: "بدء الاشتراك مع تشغيل المتجر",
  special_terms_grant: "منح شروط خاصة",
  free_plan_activate: "تفعيل الخطة المجانية",
  billing_cycle_change: "تغيير مدة الاشتراك",
  "subscription.update": "تعديل الاشتراك",
  cancel_by_customer: "إلغاء من العميل",
  referral_code_attach: "إضافة كود إحالة",
  record_payment: "تسجيل دفعة",
  reverse_payment: "إلغاء دفعة",
  refund_reported: "تسجيل استرداد",
};

/** "order.status_change" → "الطلب · تغيير الحالة" */
const readableAr = (action: string) => {
  const [head, ...rest] = action.split(".");
  if (!rest.length) return ENTITIES_AR[head] ?? readable(action);
  const [entity, verb] = readable(action).split(" · ");
  return `${ENTITIES_AR[head] ?? entity} · ${VERBS_AR[rest.join(".")] ?? verb}`;
};

export function ActivityLogPage() {
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const labels = t as Record<string, string>;
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [area, setArea] = useState("");
  const [person, setPerson] = useState("");
  const [period, setPeriod] = useState<Period>("any");
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const members = useAsync(() => apiClient.listWorkspaceMembers(workspaceId).catch(() => []), [workspaceId]);
  const query = { action: area || undefined, actorUserId: person || undefined, from: fromOf(period), limit: PAGE };

  const first = useAsync(async () => {
    const page = await activityLogList(apiClient, workspaceId, query);
    setRows(page.logs);
    setCursor(page.nextCursor);
    return page;
  }, [workspaceId, area, person, period]);

  async function loadMore() {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await activityLogList(apiClient, workspaceId, { ...query, before: cursor });
      setRows((prev) => [...prev, ...page.logs]);
      setCursor(page.nextCursor);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMore(false);
    }
  }

  const people = (members.data ?? []).filter((m) => m.user);

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label={t.area} className="h-9 w-auto" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">
            {t.area}: {t.all}
          </option>
          {AREAS.map((key) => (
            <option key={key} value={key}>
              {labels[`area.${key}`]}
            </option>
          ))}
        </Select>
        <Select aria-label={t.person} className="h-9 w-auto" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">
            {t.person}: {t.everyone}
          </option>
          {people.map((member) => (
            <option key={member.id} value={member.user?.id ?? ""}>
              {member.user?.fullName || member.user?.email}
            </option>
          ))}
        </Select>
        <Select aria-label={t.period} className="h-9 w-auto" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="any">
            {t.period}: {t.anytime}
          </option>
          <option value="today">{t.today}</option>
          <option value="week">{t.week}</option>
          <option value="month">{t.month}</option>
        </Select>
      </div>

      <DataState loading={first.loading} error={first.error} onRetry={() => void first.refresh()}>
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title={t.emptyTitle} description={t.emptyBody} />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-md border border-line bg-paper-raised">
              {rows.map((row) => {
                const hasDetails = row.before !== null || row.after !== null;
                return (
                  <li key={row.id} className="p-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm font-medium text-ink">{locale === "ar" ? readableAr(row.action) : readable(row.action)}</span>
                      <span className="text-xs text-ink-soft">
                        {row.actor ? row.actor.fullName || row.actor.email : t.system} · {new Date(row.createdAt).toLocaleString(locale === "ar" ? intlLocale : undefined)}
                        {row.ipAddress ? (
                          <>
                            {" · "}
                            <span dir="ltr">{row.ipAddress}</span>
                          </>
                        ) : null}
                      </span>
                      {hasDetails && (
                        <button
                          type="button"
                          className="ms-auto text-xs font-medium text-primary hover:underline"
                          aria-expanded={open === row.id}
                          onClick={() => setOpen(open === row.id ? null : row.id)}
                        >
                          {t.details}
                        </button>
                      )}
                    </div>
                    {open === row.id && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            [t.before, row.before],
                            [t.after, row.after],
                          ] as const
                        ).map(([label, value]) =>
                          value === null || value === undefined ? null : (
                            <div key={label} className="min-w-0">
                              <p className="text-xs font-medium text-ink-soft">{label}</p>
                              <pre dir="ltr" className="mt-1 max-h-56 overflow-auto rounded-md bg-paper p-2 text-start font-mono text-xs text-ink">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <LoadMore hasMore={Boolean(cursor)} loading={more} onClick={loadMore} />
          </>
        )}
      </DataState>
    </div>
  );
}
