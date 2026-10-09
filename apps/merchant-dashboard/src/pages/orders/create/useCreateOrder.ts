import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ordersCustomerByPhone,
  ordersManualOptions,
  ordersPreviewDraft,
  type CreateOrderPayload,
  type Offer,
  type OrderDraft,
  type OrderDraftCustomer,
  type OrderDraftPreview,
  type PaymentMethod,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { majorToMinor } from "@/lib/format";
import { getFieldErrors, isPermissionError } from "@/lib/errors";
import { asciiDigits } from "@/lib/wholeNumber";
import { refreshWorkCounts } from "@/lib/workCounts";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
// Handoff 228 / 229: the found customer's contact for the preview, and what the store set for them (pay later, tax-exempt).
import { manualDraftContact, useManualOrderB2b } from "@/pages/b2b/ManualOrderOnAccount";
import { useOrderErrorMessage } from "../orderErrors";
import { CREATE_STRINGS } from "./strings";
import { staffDiscountOf, staffItemsOf, useStaffPricingProblem } from "./staffLines";
import { clearDraft, readDraft, writeDraft, type OrderDraftSnapshot } from "./draft";
import {
  EMPTY_FORM,
  STEP_FIELDS,
  activeVariants,
  checkEgyptianMobile,
  clampQuantity,
  foldForSearch,
  isFormEmpty,
  localMobile,
  missingFields,
  productMatches,
  shippingMinorOf,
  stepOfField,
  MAX_QUANTITY,
  type OrderForm,
  type RequiredField,
  type StepIndex,
} from "./model";

/** The server prices the draft this long after the last change (as the page always did). */
const PREVIEW_DELAY_MS = 350;
/** A complete number is looked up this long after the last digit. */
const LOOKUP_DELAY_MS = 300;
/** The draft is written this long after the last change. */
const DRAFT_DELAY_MS = 400;

/** undefined: not looked up (or no number yet); null: a number new to the store. */
export type FoundCustomer = OrderDraftCustomer | null | undefined;
export type FieldErrors = Partial<Record<RequiredField, string>>;
/**
 * What the sheet should put the cursor on next: a field with something missing, the top of the step just
 * opened, or the product search (after a product went into the order, ready for the next one).
 */
export type FocusTarget = RequiredField | "step" | "search";
export type StepDirection = "none" | "forward" | "back";
/** The strip over the form: a draft was restored, or it was just cleared (and can be brought back). */
export type DraftNotice = "restored" | "cleared" | null;
/** The text fields of the form, by the name their input carries. */
export type TextFieldName = "phone" | "fullName" | "email" | "province" | "city" | "addressLine" | "notes" | "coupon" | "shipping" | "locale";

function digitsOf(text: string): string {
  return asciiDigits(text).replace(/\D/g, "");
}

function sameNumber(a: string, b: string): boolean {
  const left = localMobile(a) ?? digitsOf(a);
  const right = localMobile(b) ?? digitsOf(b);
  return left !== "" && left === right;
}

/** What a link brought: ?phone=&name= from a conversation (pages/inbox/InboxExtras.tsx). */
function linkedForm(phone: string | null, name: string | null): OrderForm {
  return { ...EMPTY_FORM, phone: asciiDigits(phone ?? "").trim(), fullName: name ?? "" };
}

/** The furthest step, up to `wanted`, with everything before it filled in. */
function openStep(form: OrderForm, wanted: StepIndex): StepIndex {
  for (const step of [0, 1] as const) {
    if (step >= wanted) break;
    if (missingFields(step, form, true).length > 0) return step;
  }
  return wanted;
}

/**
 * Where the sheet starts: the draft kept for this store, unless the link names
 * another customer — an order opened from a conversation is for that person.
 */
function startingPoint(workspaceId: string, phone: string | null, name: string | null) {
  const draft = readDraft(workspaceId);
  if (draft && (!phone || sameNumber(draft.form.phone, phone))) {
    return { form: draft.form, step: openStep(draft.form, draft.step), restored: true };
  }
  const start: StepIndex = 0;
  return { form: linkedForm(phone, name), step: start, restored: false };
}

/**
 * SPEC §4.5 — the checkout form inside the dashboard, on POST /orders: all of
 * the create-order sheet's state and behaviour, moved here from the old page
 * as it was (the customer lookup by phone, the product picker, the server
 * preview, submit and its error mapping), plus the three steps and the draft.
 * The sheet and its zones only draw what this returns.
 */
export function useCreateOrder() {
  const workspaceId = useWorkspaceId();
  const t = useT(CREATE_STRINGS);
  const toast = useToast();
  const navigate = useNavigate();
  const errorMessage = useOrderErrorMessage();
  const staffPricingProblem = useStaffPricingProblem();
  // Opened from a conversation (inbox "Create order"): ?phone=&name= start the form.
  const [params] = useSearchParams();

  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { status: "active", limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
  const options = useAsync(() => ordersManualOptions(apiClient, workspaceId), [workspaceId]);

  const [start] = useState(() => startingPoint(workspaceId, params.get("phone"), params.get("name")));

  // the form, the step, and what the stepper may jump to
  const [form, setForm] = useState<OrderForm>(start.form);
  const [step, setStep] = useState<StepIndex>(start.step);
  const [reached, setReached] = useState<StepIndex>(start.step);
  const [direction, setDirection] = useState<StepDirection>("none");
  // Something was typed, picked or removed in this sitting: only then is there anything new to keep or to ask about.
  const [touched, setTouched] = useState(false);
  // draft
  const [notice, setNotice] = useState<DraftNotice>(start.restored ? "restored" : null);
  const [cleared, setCleared] = useState<OrderDraftSnapshot | null>(null);
  const [pruned, setPruned] = useState(0);
  // customer
  const [customer, setCustomer] = useState<FoundCustomer>(undefined);
  const [lookingUp, setLookingUp] = useState(false);
  const b2b = useManualOrderB2b(customer?.id);
  // picker
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [offers, setOffers] = useState<Offer[]>([]);
  /** The product that last went into the order, said once to a screen reader. */
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  // result
  const [preview, setPreview] = useState<OrderDraftPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; seq: number } | null>(null);

  // The latest values, for code that runs later than the render it was made in (a timer, a request, leaving the page).
  const formRef = useRef(form);
  formRef.current = form;
  const stepRef = useRef(step);
  stepRef.current = step;
  const touchedRef = useRef(touched);
  touchedRef.current = touched;
  /** After the order is created the draft is gone for good: nothing writes it again. */
  const draftDone = useRef(false);

  const requestFocus = useCallback((target: FocusTarget) => {
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // ------------------------------------------------------------- editing --

  const touch = useCallback(() => {
    setTouched(true);
    // Typing again is the answer to "bring the draft back?".
    setCleared(null);
    setNotice((was) => (was === "cleared" ? null : was));
  }, []);

  const patch = useCallback(
    (changes: Partial<OrderForm>) => {
      setForm((prev) => ({ ...prev, ...changes }));
      touch();
    },
    [touch]
  );

  const clearError = useCallback((field: RequiredField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** A text field changed. The message under it goes as soon as it is typed in again. */
  function edit(field: TextFieldName, value: string) {
    const changes: Partial<OrderForm> = {};
    changes[field] = value;
    patch(changes);
    if (field === "phone" || field === "fullName" || field === "city" || field === "addressLine" || field === "shipping") {
      clearError(field);
    }
  }

  function setPaymentMethod(method: PaymentMethod) {
    patch({ paymentMethod: method });
  }

  /** For the B2B note, which puts «دفع آجل» back to cash on delivery by itself: not something the merchant typed. */
  const resetPaymentMethod = useCallback((method: PaymentMethod) => {
    setForm((prev) => (prev.paymentMethod === method ? prev : { ...prev, paymentMethod: method }));
  }, []);

  /** The code typed so far becomes the one the order is priced with (on leaving the field, or Enter). */
  function applyCoupon() {
    const code = formRef.current.coupon.trim();
    if (code !== formRef.current.appliedCoupon) patch({ appliedCoupon: code });
  }

  // ------------------------------------------------------------ customer --

  const lookupSeq = useRef(0);
  /** The number the current answer (or the request in flight) is for. */
  const lookedUp = useRef<string | null>(null);

  async function lookup(fillAddress = false) {
    const phone = formRef.current.phone.trim();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      lookupSeq.current += 1;
      lookedUp.current = null;
      setLookingUp(false);
      return setCustomer(undefined);
    }
    if (lookedUp.current === phone) return;
    lookedUp.current = phone;
    const seq = ++lookupSeq.current;
    setLookingUp(true);
    try {
      const found = await ordersCustomerByPhone(apiClient, workspaceId, phone);
      if (seq !== lookupSeq.current) return;
      setCustomer(found);
      const now = formRef.current;
      const fill: Partial<OrderForm> = {};
      // From a conversation, the name the store has for them beats the WhatsApp profile name.
      if (found?.fullName && (fillAddress || !now.fullName.trim())) fill.fullName = found.fullName;
      if (found?.email && !now.email.trim()) fill.email = found.email;
      if (fillAddress && found?.lastAddress) {
        fill.province = found.lastAddress.province ?? "";
        fill.city = found.lastAddress.city ?? "";
        fill.addressLine = found.lastAddress.addressLine ?? "";
      }
      if (Object.keys(fill).length > 0) {
        setForm((prev) => ({ ...prev, ...fill }));
        if (fill.fullName) clearError("fullName");
      }
    } catch {
      if (seq !== lookupSeq.current) return;
      lookedUp.current = null;
      setCustomer(undefined);
    } finally {
      if (seq === lookupSeq.current) setLookingUp(false);
    }
  }

  // The number is looked up as it is typed, once it is a whole mobile. A number
  // that came with the link is looked up at once, and the customer's last address filled in.
  const firstLookup = useRef(true);
  useEffect(() => {
    const first = firstLookup.current;
    firstLookup.current = false;
    if (first && params.get("phone") && !start.restored) {
      void lookup(true);
      return;
    }
    const phone = form.phone.trim();
    if (phone === lookedUp.current) return;
    // Another number: what we knew belongs to the one before.
    lookupSeq.current += 1;
    lookedUp.current = null;
    setCustomer(undefined);
    if (checkEgyptianMobile(phone) !== "valid") {
      setLookingUp(false);
      return;
    }
    setLookingUp(true);
    const timer = window.setTimeout(() => void lookup(), LOOKUP_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.phone]);

  function applyLastAddress() {
    const last = customer?.lastAddress;
    if (!last) return;
    patch({ province: last.province ?? "", city: last.city ?? "", addressLine: last.addressLine ?? "" });
    setFieldErrors((prev) => ({ ...prev, city: undefined, addressLine: undefined }));
  }

  // -------------------------------------------------------------- picker --

  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p] as const)), [catalog]);
  const matches = useMemo(() => {
    const needle = foldForSearch(search);
    return needle === "" ? catalog : catalog.filter((p) => productMatches(p, needle));
  }, [catalog, search]);

  const product: Product | undefined = productById.get(productId);
  const variants = activeVariants(product);

  // A product's offers load when it is opened; its first variant is preselected.
  useEffect(() => {
    setOfferId("");
    // The list already carries a product's offers where the server sends them: no chip pops in a moment later.
    setOffers((product?.offers ?? []).filter((o) => o.status === "active"));
    if (!product) return;
    setVariantId(variants[0]?.id ?? "");
    setQuantity(1);
    let cancelled = false;
    apiClient
      .listOffers(workspaceId, product.id)
      .then((list) => !cancelled && setOffers(list.filter((o) => o.status === "active")))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  /** Opens a product in place (its variants, offers and quantity), or folds the one that is open. */
  function toggleProduct(id: string) {
    setProductId((was) => (was === id ? "" : id));
    clearError("items");
  }

  /** Enter in the search field: the first product found opens. */
  function openFirstMatch() {
    const first = matches[0];
    if (first && first.id !== productId) setProductId(first.id);
  }

  /** Adds what is chosen in the open product. The same variant with the same offer adds to its line. */
  function addLine(): boolean {
    const variant = variants.find((v) => v.id === variantId);
    if (!product || !variant) return false;
    const qty = clampQuantity(quantity);
    const offer = offers.find((o) => o.id === offerId);
    const picked = product;
    setForm((prev) => {
      const at = prev.lines.findIndex((l) => l.variantId === variant.id && (l.offerId ?? "") === (offer?.id ?? ""));
      const lines =
        at >= 0
          ? prev.lines.map((l, i) => (i === at ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + qty) } : l))
          : [
              ...prev.lines,
              {
                key: `${Date.now()}-${prev.lines.length}`,
                productId: picked.id,
                variantId: variant.id,
                offerId: offer?.id,
                offerName: offer?.name,
                quantity: qty,
              },
            ];
      return { ...prev, lines };
    });
    touch();
    clearError("items");
    setLastAdded(picked.name);
    setProductId("");
    setQuantity(1);
    return true;
  }

  function setLineQuantity(key: string, value: number) {
    const next = clampQuantity(value);
    setForm((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.key === key ? { ...l, quantity: next } : l)) }));
    touch();
  }

  function removeLine(key: string) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== key) }));
    touch();
  }

  // A restored draft may hold a product that has left the shelf since: it cannot be sold, so its line goes.
  useEffect(() => {
    if (!products.data) return;
    const onSale = new Set<string>();
    for (const p of products.data) for (const v of activeVariants(p)) onSale.add(v.id);
    // A custom line (handoff 382) is not in the catalogue: it never leaves the shelf.
    const gone = formRef.current.lines.filter((l) => !l.custom && !onSale.has(l.variantId)).length;
    if (gone === 0) return;
    setPruned(gone);
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.custom || onSale.has(l.variantId)) }));
  }, [products.data]);

  // ------------------------------------------------------------- preview --

  const shippingMinor = shippingMinorOf(form.shipping, majorToMinor);
  const shippingOk = shippingMinor === undefined || !Number.isNaN(shippingMinor);
  // Something that is not an amount never reaches the server: the preview stays on the calculated shipping.
  const previewShipping = shippingOk ? shippingMinor : undefined;

  const draft: OrderDraft | null = useMemo(
    () =>
      form.lines.length === 0
        ? null
        : {
            // Handoff 382: a staff price rides on its line, a custom line goes by its title, and the staff discount with them.
            items: staffItemsOf(form.lines),
            ...staffDiscountOf(form),
            shippingAddress: { country: "EG", province: form.province || undefined, city: form.city, addressLine: form.addressLine },
            paymentMethod: form.paymentMethod,
            discountCode: form.appliedCoupon || undefined,
            shippingAmount: previewShipping,
            // The found customer, so the preview is priced for them: no tax when exempt, their credit limit on «دفع آجل».
            ...manualDraftContact(customer),
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.lines, form.province, form.paymentMethod, form.appliedCoupon, previewShipping, customer, form.staffDiscount]
  );

  // The server prices the draft; nothing is computed here. The last answer stays
  // on screen (dimmed by the footer) while the next one is on its way.
  useEffect(() => {
    if (!draft) {
      setPreview(null);
      setPreviewError(null);
      setPricing(false);
      return;
    }
    let cancelled = false;
    setPricing(true);
    const timer = window.setTimeout(() => {
      ordersPreviewDraft(apiClient, workspaceId, draft)
        .then((p) => {
          if (cancelled) return;
          setPreview(p);
          setPreviewError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(errorMessage(err));
        })
        .finally(() => !cancelled && setPricing(false));
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, workspaceId]);

  /** The preview's line for the line at `index`, when it is still about the same thing (a line may just have been removed). */
  function pricedLine(index: number): OrderDraftPreview["items"][number] | null {
    const line = form.lines[index];
    const item = preview?.items[index];
    if (!line || !item) return null;
    // A custom line has no variant on either side (handoff 382).
    if (line.custom) return item.variantId ? null : item;
    if (item.variantId !== line.variantId || (item.offerId ?? "") !== (line.offerId ?? "")) return null;
    return item;
  }

  // --------------------------------------------------------------- steps --

  function messageFor(field: RequiredField): string {
    switch (field) {
      case "phone":
        return checkEgyptianMobile(form.phone) === "empty" ? t.phoneRequired : fmt(t.phoneInvalid, { digits: 11, prefix: "01" });
      case "fullName":
        return t.nameRequired;
      case "items":
        return t.noItems;
      case "city":
        return t.cityRequired;
      case "addressLine":
        return t.addressRequired;
      case "shipping":
        return t.shippingInvalid;
    }
  }

  function go(target: StepIndex) {
    if (target !== stepRef.current) setDirection(target > stepRef.current ? "forward" : "back");
    setStep(target);
    setReached((was) => (target > was ? target : was));
    // «كمّلنا من آخر مرة» has been read by the time the merchant moves on.
    setNotice((was) => (was === "restored" ? null : was));
    requestFocus("step");
  }

  /** Says what is missing under its field, on the step it lives on, and puts the cursor there. */
  function showMissing(field: RequiredField) {
    const at = stepOfField(field);
    const errors: FieldErrors = {};
    errors[field] = messageFor(field);
    setFieldErrors(errors);
    if (at !== stepRef.current) go(at);
    requestFocus(field);
  }

  /**
   * The primary button, and Enter in a field of the first two steps. Never
   * refused in silence: with something missing, its message shows under the
   * first such field and the cursor goes there. `from` is the field Enter was
   * pressed in: a missing field further down is simply moved to, with nothing
   * said yet.
   */
  function next(from?: string) {
    if (saving) return;
    setFormError(null);
    // A product is open and chosen but not added, and the order is still empty: «التالي» takes it along.
    if (step === 1 && form.lines.length === 0 && addLine()) {
      setFieldErrors({});
      go(2);
      return;
    }
    const first = missingFields(step, form, shippingOk)[0];
    if (first) {
      const order = STEP_FIELDS[step];
      const fromAt = from ? order.indexOf(from) : -1;
      if (fromAt >= 0 && order.indexOf(first) > fromAt) requestFocus(first);
      else showMissing(first);
      return;
    }
    setFieldErrors({});
    if (step === 0) go(1);
    else if (step === 1) go(2);
    else void submit();
  }

  /**
   * Enter in a field. On the first two steps it is the primary button. On the
   * last one it never creates the order — only the button does: it moves to
   * what is still missing, and returns false when nothing is (the caller lets
   * the keyboard go).
   */
  function enter(from: string): boolean {
    if (step !== 2) {
      next(from);
      return true;
    }
    const first = missingFields(2, form, shippingOk)[0];
    if (!first) return false;
    const order = STEP_FIELDS[2];
    const fromAt = order.indexOf(from);
    if (fromAt >= 0 && order.indexOf(first) > fromAt) requestFocus(first);
    else showMissing(first);
    return true;
  }

  /** A press on the stepper: back at any time; forward only over steps that are complete. */
  function goTo(target: StepIndex) {
    if (saving || target === step) return;
    if (target < step) {
      setFieldErrors({});
      go(target);
      return;
    }
    for (const between of [0, 1, 2] as const) {
      if (between < step || between >= target) continue;
      const first = missingFields(between, form, shippingOk)[0];
      if (first) return showMissing(first);
    }
    setFieldErrors({});
    go(target);
  }

  /** Is this step filled in, as far as the browser can tell? */
  function stepComplete(at: StepIndex): boolean {
    return missingFields(at, form, shippingOk).length === 0;
  }

  // -------------------------------------------------------------- submit --

  async function submit() {
    // Every step once more, in order: the first with something missing takes the merchant back to it.
    for (const at of [0, 1, 2] as const) {
      const first = missingFields(at, form, shippingOk)[0];
      if (first) return showMissing(first);
    }

    // Handoff 382: a staff discount without its reason, or a price that is not one, is said — never dropped in silence.
    const staffProblem = staffPricingProblem(form);
    if (staffProblem) return setFormError(staffProblem);

    setSaving(true);
    setFormError(null);
    const payload = {
      items: staffItemsOf(form.lines),
      ...staffDiscountOf(form),
      contact: { fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined },
      shippingAddress: {
        country: "EG",
        province: form.province || undefined,
        city: form.city.trim(),
        addressLine: form.addressLine.trim(),
      },
      paymentMethod: form.paymentMethod,
      discountCode: form.appliedCoupon || undefined,
      notes: form.notes.trim() || undefined,
      ...(shippingMinor !== undefined ? { shippingAmount: shippingMinor } : {}),
      // The language the customer's messages go out in; left out = the store's default (handoff 383).
      ...(form.locale ? { locale: form.locale } : {}),
    } as CreateOrderPayload;
    try {
      const order = await apiClient.createOrder(workspaceId, payload);
      draftDone.current = true;
      clearDraft(workspaceId);
      // A new cash-on-delivery order is one more call to make: the dock and the menu hear of it now.
      refreshWorkCounts();
      toast.success(fmt(t.created, { number: order.orderNumber }));
      // In place of /orders/new: Back from the new order lands on the list, not on an empty sheet.
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      const fields = getFieldErrors(err);
      const mapped: FieldErrors = {
        phone: fields["contact.phone"],
        fullName: fields["contact.fullName"],
        city: fields["shippingAddress.city"],
        addressLine: fields["shippingAddress.addressLine"],
      };
      setFieldErrors(mapped);
      setFormError(errorMessage(err));
      // The field the server refused, on the step it lives on.
      const first = (["phone", "fullName", "city", "addressLine"] as const).find((name) => mapped[name]);
      if (first) {
        if (stepOfField(first) !== stepRef.current) go(stepOfField(first));
        requestFocus(first);
      } else if (fields.items && stepRef.current !== 1) {
        go(1);
      }
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------------------- draft --

  const saveDraftNow = useCallback(() => {
    if (draftDone.current || !touchedRef.current) return;
    writeDraft(workspaceId, { form: formRef.current, step: stepRef.current });
  }, [workspaceId]);

  // Saved on change, a moment after the last one.
  useEffect(() => {
    if (!touched) return;
    const timer = window.setTimeout(saveDraftNow, DRAFT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [form, step, touched, saveDraftNow]);

  // And at once when the sheet goes away by any road: Back, a link, a reload.
  useEffect(() => {
    window.addEventListener("pagehide", saveDraftNow);
    return () => {
      window.removeEventListener("pagehide", saveDraftNow);
      saveDraftNow();
    };
  }, [saveDraftNow]);

  /** «امسح المسودة»: an empty form (the link's customer, if there was one), with a way back for a moment. */
  function clearDraftNow() {
    setCleared({ form: formRef.current, step: stepRef.current });
    clearDraft(workspaceId);
    if (stepRef.current !== 0) setDirection("back");
    setForm(linkedForm(params.get("phone"), params.get("name")));
    setStep(0);
    setReached(0);
    setTouched(false);
    setNotice("cleared");
    setPruned(0);
    setFieldErrors({});
    setFormError(null);
    setProductId("");
    setSearch("");
    requestFocus("step");
  }

  /** «رجّعها»: the cleared draft, as it was. */
  function undoClear() {
    if (!cleared) return;
    if (cleared.step !== stepRef.current) setDirection("forward");
    setForm(cleared.form);
    setStep(cleared.step);
    setReached(cleared.step);
    setTouched(true);
    setCleared(null);
    setNotice(null);
    requestFocus("step");
  }

  return {
    // data
    products,
    options,
    catalog,
    matches,
    productById,
    /** The role may not read the catalog: there is no order to build here. */
    blocked: isPermissionError(products.error),
    // form
    form,
    /** Any change to the form that is not one text field (handoff 382: a line's staff price, a custom line, the staff discount). */
    patchForm: patch,
    edit,
    setPaymentMethod,
    resetPaymentMethod,
    applyCoupon,
    fieldErrors,
    formError,
    // steps
    step,
    reached,
    direction,
    stepComplete,
    next,
    enter,
    goTo,
    focusRequest,
    saving,
    // customer
    customer,
    lookingUp,
    lookupNow: () => void lookup(),
    applyLastAddress,
    b2b,
    /** The found customer's terms are known (or there is no customer to have any): the on-account note may judge. */
    b2bReady: !lookingUp && (!customer || b2b !== null),
    // picker
    search,
    setSearch,
    productId,
    product,
    variants,
    variantId,
    setVariantId,
    offers,
    offerId,
    setOfferId,
    quantity,
    setQuantity,
    toggleProduct,
    openFirstMatch,
    addLine,
    lastAdded,
    /** Back to the search after adding, for whoever is working with a keyboard. */
    focusSearch: () => requestFocus("search"),
    setLineQuantity,
    removeLine,
    // totals
    preview,
    previewError,
    pricing,
    pricedLine,
    currency: preview?.currency ?? "EGP",
    shippingOk,
    // draft
    notice,
    pruned,
    canUndoClear: cleared !== null,
    clearDraftNow,
    undoClear,
    saveDraftNow,
    /** Something typed in this sitting that closing would interrupt. */
    dirty: touched && !isFormEmpty(form),
  };
}

export type CreateOrder = ReturnType<typeof useCreateOrder>;
