import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, CardContent, Input, Label } from "@store-builder/ui";
import {
  catalogUpdateProduct,
  resolveProductCms,
  type CatalogProduct,
  type ProductCms,
  type ProductCmsFaq,
  type ProductCmsFeature,
  type ProductCmsTestimonial,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { ImageUrlInput } from "./ImageUrlInput";

/**
 * The product's structured content (SPEC §7.4): features, testimonials and
 * FAQs. Shown on the product page and bound by page-builder elements, so one
 * template works for any product. Saved whole as the product's `cms`.
 */

const LIMITS = { features: 12, testimonials: 12, faqs: 20 } as const;

const STRINGS = {
  en: {
    title: "Product content",
    description: "Features, customer testimonials and questions shown on the product page.",
    tab_features: "Features",
    tab_testimonials: "Testimonials",
    tab_faqs: "FAQs",
    empty_features: "No features yet. Add the three or four things that make this product worth buying.",
    empty_testimonials: "No testimonials yet. Add what real customers told you — on WhatsApp, in comments, in person.",
    empty_faqs: "No questions yet. Answer what shoppers ask before they order.",
    add_features: "Add feature",
    add_testimonials: "Add testimonial",
    add_faqs: "Add question",
    testimonialsNote: "Only real words from real customers. Invented testimonials are not allowed.",
    featureTitle: "Title",
    featureDescription: "Description",
    image: "Image",
    name: "Customer name",
    text: "What they said",
    rating: "Rating",
    noRating: "No rating",
    stars: "{n} of 5",
    question: "Question",
    answer: "Answer",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    incomplete: "Fill in the required fields of every item, or remove the empty ones.",
    save: "Save content",
    saving: "Saving…",
    saved: "Product content saved.",
    discard: "Discard changes",
  },
  ar: {
    title: "محتوى المنتج",
    description: "المميزات وآراء العملاء والأسئلة التي تظهر في صفحة المنتج.",
    tab_features: "المميزات",
    tab_testimonials: "آراء العملاء",
    tab_faqs: "الأسئلة الشائعة",
    empty_features: "مفيش مميزات لسه. أضف ثلاثة أو أربعة أسباب تجعل المنتج يستحق الشراء.",
    empty_testimonials: "مفيش آراء لسه. أضف ما قاله عملاء حقيقيون — على واتساب أو في التعليقات.",
    empty_faqs: "مفيش أسئلة لسه. أجب عمّا يسأله العملاء قبل الطلب.",
    add_features: "إضافة ميزة",
    add_testimonials: "إضافة رأي",
    add_faqs: "إضافة سؤال",
    testimonialsNote: "كلام حقيقي من عملاء حقيقيين فقط. غير مسموح بآراء مختلقة.",
    featureTitle: "العنوان",
    featureDescription: "الوصف",
    image: "الصورة",
    name: "اسم العميل",
    text: "ماذا قال",
    rating: "التقييم",
    noRating: "بدون تقييم",
    stars: "{n} من 5",
    question: "السؤال",
    answer: "الإجابة",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    remove: "حذف",
    incomplete: "أكمل الحقول المطلوبة في كل عنصر، أو احذف الفارغ منها.",
    save: "حفظ المحتوى",
    saving: "بنحفظ…",
    saved: "اتحفظ محتوى المنتج.",
    discard: "تجاهل التغييرات",
  },
} satisfies Messages;

type Tab = keyof typeof LIMITS;
const TABS: Tab[] = ["features", "testimonials", "faqs"];

const iconButton =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

function normalize(cms: ProductCms): ProductCms {
  return {
    features: cms.features.map((f) => ({
      title: f.title.trim(),
      description: (f.description ?? "").trim(),
      image: f.image || null,
    })),
    testimonials: cms.testimonials.map((x) => ({
      name: x.name.trim(),
      text: x.text.trim(),
      image: x.image || null,
      rating: x.rating ?? null,
    })),
    faqs: cms.faqs.map((q) => ({ question: q.question.trim(), answer: q.answer.trim() })),
  };
}

export function ProductCmsSection({ product, onChanged }: { product: CatalogProduct; onChanged: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [saved, setSaved] = useState(() => normalize(resolveProductCms(product.cms)));
  const [cms, setCms] = useState(saved);
  const [tab, setTab] = useState<Tab>("features");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(normalize(cms)) !== JSON.stringify(saved);

  function setList<K extends Tab>(key: K, next: ProductCms[K]) {
    setCms((current) => ({ ...current, [key]: next }));
  }
  function patchItem<K extends Tab>(key: K, index: number, change: Partial<ProductCms[K][number]>) {
    setList(key, cms[key].map((item, i) => (i === index ? { ...item, ...change } : item)) as ProductCms[K]);
  }
  function move(key: Tab, index: number, to: number) {
    const list = [...cms[key]];
    if (to < 0 || to >= list.length) return;
    const [row] = list.splice(index, 1);
    list.splice(to, 0, row as never);
    setList(key, list as ProductCms[typeof key]);
  }
  function remove(key: Tab, index: number) {
    setList(key, cms[key].filter((_, i) => i !== index) as ProductCms[typeof key]);
  }
  function add(key: Tab) {
    if (key === "features") setList("features", [...cms.features, { title: "", description: "", image: null }]);
    if (key === "testimonials")
      setList("testimonials", [...cms.testimonials, { name: "", text: "", image: null, rating: 5 }]);
    if (key === "faqs") setList("faqs", [...cms.faqs, { question: "", answer: "" }]);
  }

  async function save() {
    const next = normalize(cms);
    const incomplete =
      next.features.some((f) => !f.title) ||
      next.testimonials.some((x) => !x.name || !x.text) ||
      next.faqs.some((q) => !q.question || !q.answer);
    if (incomplete) {
      setError(t.incomplete);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await catalogUpdateProduct(apiClient, workspaceId, product.id, { cms: next });
      setSaved(next);
      setCms(next);
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const row = (key: Tab, index: number, children: ReactNode) => (
    <li key={index} className="rounded-[0.5rem] border border-line p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-3">{children}</div>
        <div className="flex shrink-0 flex-col">
          <button type="button" className={iconButton} aria-label={t.moveUp} disabled={busy || index === 0} onClick={() => move(key, index, index - 1)}>
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={t.moveDown}
            disabled={busy || index === cms[key].length - 1}
            onClick={() => move(key, index, index + 1)}
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`${iconButton} hover:bg-danger-soft hover:text-danger`}
            aria-label={t.remove}
            disabled={busy}
            onClick={() => remove(key, index)}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );

  const labelled = (id: string, label: string, control: ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
    </div>
  );

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
        </div>

        <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-medium transition-colors ${
                tab === key ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t[`tab_${key}`]}
              <span className="ms-1.5 text-xs text-ink-soft">{cms[key].length}</span>
            </button>
          ))}
        </div>

        {tab === "testimonials" && <p className="text-xs text-ink-soft">{t.testimonialsNote}</p>}
        {cms[tab].length === 0 && <p className="text-sm text-ink-soft">{t[`empty_${tab}`]}</p>}

        <ol className="space-y-3">
          {tab === "features" &&
            cms.features.map((feature: ProductCmsFeature, index) =>
              row(
                "features",
                index,
                <>
                  {labelled(
                    `cms-f-title-${index}`,
                    t.featureTitle,
                    <Input
                      id={`cms-f-title-${index}`}
                      maxLength={120}
                      value={feature.title}
                      disabled={busy}
                      onChange={(e) => patchItem("features", index, { title: e.target.value })}
                    />
                  )}
                  {labelled(
                    `cms-f-desc-${index}`,
                    t.featureDescription,
                    <Textarea
                      id={`cms-f-desc-${index}`}
                      maxLength={600}
                      value={feature.description ?? ""}
                      disabled={busy}
                      onChange={(e) => patchItem("features", index, { description: e.target.value })}
                    />
                  )}
                  {labelled(
                    `cms-f-img-${index}`,
                    t.image,
                    <ImageUrlInput
                      id={`cms-f-img-${index}`}
                      value={feature.image ?? ""}
                      disabled={busy}
                      onChange={(url) => patchItem("features", index, { image: url || null })}
                    />
                  )}
                </>
              )
            )}

          {tab === "testimonials" &&
            cms.testimonials.map((item: ProductCmsTestimonial, index) =>
              row(
                "testimonials",
                index,
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {labelled(
                      `cms-t-name-${index}`,
                      t.name,
                      <Input
                        id={`cms-t-name-${index}`}
                        maxLength={80}
                        value={item.name}
                        disabled={busy}
                        onChange={(e) => patchItem("testimonials", index, { name: e.target.value })}
                      />
                    )}
                    {labelled(
                      `cms-t-rating-${index}`,
                      t.rating,
                      <Select
                        id={`cms-t-rating-${index}`}
                        value={item.rating ? String(item.rating) : ""}
                        disabled={busy}
                        onChange={(e) =>
                          patchItem("testimonials", index, { rating: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">{t.noRating}</option>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {fmt(t.stars, { n })}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                  {labelled(
                    `cms-t-text-${index}`,
                    t.text,
                    <Textarea
                      id={`cms-t-text-${index}`}
                      maxLength={800}
                      value={item.text}
                      disabled={busy}
                      onChange={(e) => patchItem("testimonials", index, { text: e.target.value })}
                    />
                  )}
                  {labelled(
                    `cms-t-img-${index}`,
                    t.image,
                    <ImageUrlInput
                      id={`cms-t-img-${index}`}
                      value={item.image ?? ""}
                      disabled={busy}
                      onChange={(url) => patchItem("testimonials", index, { image: url || null })}
                    />
                  )}
                </>
              )
            )}

          {tab === "faqs" &&
            cms.faqs.map((item: ProductCmsFaq, index) =>
              row(
                "faqs",
                index,
                <>
                  {labelled(
                    `cms-q-${index}`,
                    t.question,
                    <Input
                      id={`cms-q-${index}`}
                      maxLength={200}
                      value={item.question}
                      disabled={busy}
                      onChange={(e) => patchItem("faqs", index, { question: e.target.value })}
                    />
                  )}
                  {labelled(
                    `cms-a-${index}`,
                    t.answer,
                    <Textarea
                      id={`cms-a-${index}`}
                      maxLength={1500}
                      value={item.answer}
                      disabled={busy}
                      onChange={(e) => patchItem("faqs", index, { answer: e.target.value })}
                    />
                  )}
                </>
              )
            )}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || cms[tab].length >= LIMITS[tab]}
          onClick={() => add(tab)}
        >
          <Plus className="size-4" aria-hidden />
          {t[`add_${tab}`]}
        </Button>

        {error && <Alert variant="danger">{error}</Alert>}

        {dirty && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setCms(saved);
                setError(null);
              }}
            >
              {t.discard}
            </Button>
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
