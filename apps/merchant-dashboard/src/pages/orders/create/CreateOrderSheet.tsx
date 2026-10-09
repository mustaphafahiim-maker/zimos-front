import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@store-builder/ui";
import { DataState } from "@/components/DataState";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader } from "@/components/Sheet";
import { useT } from "@/i18n/LocaleContext";
import { CREATE_STRINGS } from "./strings";
import type { RequiredField, StepIndex } from "./model";
import { useCreateOrder } from "./useCreateOrder";
import { OrderStepper } from "./OrderStepper";
import { DraftStrip } from "./DraftStrip";
import { CustomerStep } from "./CustomerStep";
import { ProductsStep } from "./ProductsStep";
import { DeliveryStep } from "./DeliveryStep";
import { OrderFooter } from "./OrderFooter";
import { revealInBody } from "./reveal";

export interface CreateOrderSheetProps {
  open: boolean;
  /** Called with `false` once the sheet may really close (after the question, when there is something typed). */
  onOpenChange: (open: boolean) => void;
}

/** The product search of step 2 (components/list ListToolbar draws it). */
const SEARCH = 'input[type="search"]';

/** Where the cursor goes when a step opens (with a pointer; by touch the step itself, so no keyboard rises). */
const STEP_FIRST: Record<StepIndex, string> = {
  0: 'input[name="phone"]',
  1: SEARCH,
  2: 'select[name="province"]',
};

/** The control of a field that is missing something. An order with no product points at the search. */
const FIELD_CONTROL: Record<RequiredField, string> = {
  phone: 'input[name="phone"]',
  fullName: 'input[name="fullName"]',
  items: SEARCH,
  city: 'input[name="city"]',
  addressLine: 'input[name="addressLine"]',
  shipping: 'input[inputmode="decimal"]',
};

// A step comes in from the side it lies on: the next one from the end, the one before from the start
// (mirrored in Arabic). Transform and opacity only, on the house spring; nothing moves under reduced motion.
const STEP_IN =
  "motion-safe:animate-[order-create-step_var(--dur-move)_var(--ease-spring)_both] " +
  "ltr:data-[dir=forward]:[--oc-from:1.25rem] ltr:data-[dir=back]:[--oc-from:-1.25rem] " +
  "rtl:data-[dir=forward]:[--oc-from:-1.25rem] rtl:data-[dir=back]:[--oc-from:1.25rem]";

function coarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Create order as a sheet in three short steps over the orders list
 * (docs/ux/REDESIGN_PROMPT.md §2.3): the stepper at the top, the step in the
 * scrolling middle, the running total and the one button pinned at the foot.
 *
 * Closing — Escape, the cross, a tap on the dimmed page, pulling the sheet
 * down — asks once when something was typed in this sitting; the draft is kept
 * whatever the answer, so a second request to close simply closes. Enter in a
 * field is the step's button on the first two steps and never creates the
 * order on the last.
 *
 * All behaviour is in `useCreateOrder`; the material is in glass/order-create.css.
 */
export function CreateOrderSheet({ open, onOpenChange }: CreateOrderSheetProps) {
  const t = useT(CREATE_STRINGS);
  const ctl = useCreateOrder();
  const [asking, setAsking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryId = useId();

  const stepNames: Record<StepIndex, string> = { 0: t.stepCustomer, 1: t.stepProducts, 2: t.stepDelivery };

  function leave() {
    ctl.saveDraftNow();
    setAsking(false);
    onOpenChange(false);
  }

  function requestClose() {
    // The order is on its way to the server: its answer decides where we go.
    if (ctl.saving) return;
    if (ctl.dirty && !asking) {
      setAsking(true);
      return;
    }
    leave();
  }

  function keepGoing() {
    setAsking(false);
    // The question's buttons are gone: hand focus to the one button rather than lose it.
    window.requestAnimationFrame(() => document.getElementById(primaryId)?.focus());
  }

  // Going on with the form is an answer too.
  useEffect(() => {
    setAsking(false);
  }, [ctl.form, ctl.step]);

  // The cursor follows the flow: the top of a step that just opened, or the field with something missing.
  useEffect(() => {
    const request = ctl.focusRequest;
    const form = formRef.current;
    if (!request || !form) return;
    if (request.target === "search") {
      // Where it is, without scrolling: the merchant may be deep in the list, about to add its neighbour.
      form.querySelector<HTMLElement>(SEARCH)?.focus({ preventScroll: true });
      return;
    }
    if (request.target === "step") {
      bodyRef.current?.scrollTo({ top: 0 });
      const first = coarsePointer() ? null : form.querySelector<HTMLElement>(STEP_FIRST[ctl.step]);
      (first ?? panelRef.current)?.focus({ preventScroll: true });
      return;
    }
    const control = form.querySelector<HTMLElement>(FIELD_CONTROL[request.target]);
    if (!control) return;
    revealInBody(control, "center");
    control.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl.focusRequest]);

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.defaultPrevented) return;
    const field = event.target;
    // A textarea takes the line break, a button its press, a select its list.
    if (!(field instanceof HTMLInputElement) || field.type === "checkbox" || field.type === "radio") return;
    event.preventDefault();
    if (field.type === "search") {
      // The first product found opens, and the cursor waits on «ضيف للأوردر»: type, Enter, Enter.
      ctl.openFirstMatch();
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[data-slot="order-add"]')?.focus());
      return;
    }
    if (!ctl.enter(field.name)) field.blur();
  }

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      side="auto"
      size="lg"
      // One height for all three steps, so the sheet does not resize as they change: 92dvh on a phone.
      className="zimos-order-create h-[92dvh] sm:h-[min(85dvh,46rem)]"
      popupProps={{
        initialFocus: (openType) => {
          const panel = panelRef.current;
          if (!panel) return true;
          // On a touch screen the step itself, however the sheet was opened: a field would raise the keyboard over it.
          if (openType === "touch" || coarsePointer()) return panel;
          return panel.querySelector<HTMLElement>(STEP_FIRST[ctl.step]) ?? panel;
        },
      }}
    >
      <SheetHeader title={t.title} description={<span className="max-sm:sr-only">{t.description}</span>} />

      {ctl.blocked ? (
        // A role that may not read the catalog has no order to build: who can grant it, in place of the form.
        <SheetBody>
          <DataState loading={false} error={ctl.products.error}>
            {null}
          </DataState>
        </SheetBody>
      ) : (
        <>
          <OrderStepper ctl={ctl} />

          <SheetBody ref={bodyRef} className="scroll-py-4 overflow-x-hidden">
            <form ref={formRef} noValidate data-slot="order-create-form" onSubmit={(event) => event.preventDefault()} onKeyDown={onKeyDown}>
              <DraftStrip ctl={ctl} />
              <div
                key={ctl.step}
                ref={panelRef}
                tabIndex={-1}
                role="group"
                aria-label={stepNames[ctl.step]}
                data-slot="order-step-panel"
                data-dir={ctl.direction}
                className={cn("outline-none", ctl.direction !== "none" && STEP_IN)}
              >
                {ctl.step === 0 ? <CustomerStep ctl={ctl} /> : ctl.step === 1 ? <ProductsStep ctl={ctl} /> : <DeliveryStep ctl={ctl} />}
              </div>
            </form>
          </SheetBody>

          {/* Totals, then the button: stacked on the phone (the button last, by the thumb), side by side from sm. */}
          <SheetFooter className="flex-col gap-3 sm:justify-between">
            <OrderFooter ctl={ctl} primaryId={primaryId} asking={asking} onKeep={keepGoing} onLeave={leave} />
          </SheetFooter>
        </>
      )}
    </SheetFrame>
  );
}
