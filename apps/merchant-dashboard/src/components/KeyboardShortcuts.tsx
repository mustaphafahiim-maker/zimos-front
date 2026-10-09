import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { findNavItem, isNavItemVisible } from "@/lib/navigation";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";

/** Fired on `window` to open the list of shortcuts (the account menu does). */
export const SHORTCUTS_HELP_EVENT = "zimos:shortcuts-help";
/** Fired on `window` to switch full screen on or off (the layout listens). */
export const FOCUS_TOGGLE_EVENT = "zimos:focus-toggle";

const STRINGS = {
  en: {
    title: "Keyboard shortcuts",
    description: "They work anywhere in the dashboard, except while you are typing in a field.",
    do: "Do",
    go: "Go to — press G, then the letter",
    search: "Search and jump to any page",
    quickLook: "Quick Look at the row you are on",
    close: "Close what is open",
    help: "Show this list",
    focus: "Full screen: hide or show the side menu",
    newOrder: "New order",
    newProduct: "Add product",
    home: "Home",
    orders: "Orders",
    confirm: "Orders to confirm",
    products: "Products",
    customers: "Customers",
    analytics: "Reports",
    affiliates: "Affiliates",
    website: "Store editor",
    settings: "Settings",
    then: "then",
    or: "or",
    // What is printed on the key. Esc and Ctrl read the same on an Arabic keyboard.
    keySpace: "Space",
    keyEsc: "Esc",
    keyCtrl: "Ctrl",
  },
  ar: {
    title: "اختصارات الكيبورد",
    description: "شغّالة في أي مكان في الداشبورد، إلا وإنت بتكتب في خانة.",
    do: "اعمل",
    go: "روح لـ — دوس G وبعدها الحرف",
    search: "دوّر وروح لأي صفحة",
    quickLook: "بصّة سريعة على الصف اللي واقف عليه",
    close: "اقفل اللي مفتوح",
    help: "اعرض القايمة دي",
    focus: "ملء الشاشة: خبّي أو رجّع القايمة الجانبية",
    newOrder: "أوردر جديد",
    newProduct: "ضيف منتج",
    home: "الرئيسية",
    orders: "الأوردرات",
    confirm: "أوردرات مستنية تأكيد",
    products: "المنتجات",
    customers: "العملاء",
    analytics: "التقارير",
    affiliates: "المسوّقين بالعمولة",
    website: "محرر المتجر",
    settings: "الإعدادات",
    then: "وبعدها",
    or: "أو",
    keySpace: "مسافة",
    keyEsc: "Esc",
    keyCtrl: "Ctrl",
  },
} satisfies Messages;

type Label = keyof (typeof STRINGS)["en"];

/** One key. Matched by physical key, so they work on an Arabic layout too. */
const DIRECT: Array<{ code: string; cap: string; to: string; label: Label }> = [
  { code: "KeyN", cap: "N", to: "/orders/new", label: "newOrder" },
  { code: "KeyP", cap: "P", to: "/catalog/new", label: "newProduct" },
];

/** G, then one key. */
const GO: Array<{ code: string; cap: string; to: string; label: Label }> = [
  { code: "KeyH", cap: "H", to: "/", label: "home" },
  { code: "KeyO", cap: "O", to: "/orders", label: "orders" },
  { code: "KeyC", cap: "C", to: "/confirmation-queue", label: "confirm" },
  { code: "KeyP", cap: "P", to: "/catalog", label: "products" },
  { code: "KeyU", cap: "U", to: "/customers", label: "customers" },
  { code: "KeyA", cap: "A", to: "/analytics", label: "analytics" },
  { code: "KeyM", cap: "M", to: "/affiliates", label: "affiliates" },
  { code: "KeyW", cap: "W", to: "/website", label: "website" },
  { code: "KeyS", cap: "S", to: "/settings", label: "settings" },
];

/** The search palette's own shortcut is ⌘K on Apple keyboards and Ctrl K everywhere else. */
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * One key, drawn as a keycap: at least 26 by 26, a hairline edge that is
 * thicker along the bottom, 12px mono. The lit glass face is in
 * glass/states.css (`.zimos-keycap`).
 */
function Key({ children }: { children: string }) {
  return (
    <kbd className="zimos-keycap inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[7px] border border-b-2 border-line-strong/45 bg-paper-raised px-1.5 font-mono text-xs leading-none font-medium text-ink">
      {children}
    </kbd>
  );
}

/**
 * Dashboard-wide keyboard shortcuts and the dialog that lists them. Mounted
 * once in the layout. Nothing fires while a field has focus, while a dialog
 * is open, or with Ctrl/Alt/Cmd held, so typing and browser shortcuts are
 * never taken over.
 */
export function KeyboardShortcuts() {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role;
  const [open, setOpen] = useState(false);
  // The handler reads the latest role and dialog state without re-subscribing.
  const state = useRef({ role, open });
  state.current = { role, open };

  useEffect(() => {
    let waitingForSecondKey = false;
    let timer: number | undefined;

    const go = (to: string) => {
      const item = findNavItem(to);
      if (item && !isNavItemVisible(item, state.current.role)) return;
      navigate(to);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (state.current.open || document.querySelector('[role="dialog"], [role="menu"]')) return;

      if (e.code === "Slash") {
        e.preventDefault();
        if (e.shiftKey) setOpen(true);
        // The search palette owns Ctrl+K; "/" is the one-key way to it.
        else window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
        return;
      }
      if (e.shiftKey) return;

      if (waitingForSecondKey) {
        waitingForSecondKey = false;
        window.clearTimeout(timer);
        const destination = GO.find((entry) => entry.code === e.code);
        if (destination) {
          e.preventDefault();
          go(destination.to);
        }
        return;
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        window.dispatchEvent(new Event(FOCUS_TOGGLE_EVENT));
        return;
      }
      if (e.code === "KeyG") {
        waitingForSecondKey = true;
        timer = window.setTimeout(() => {
          waitingForSecondKey = false;
        }, 1500);
        return;
      }
      const action = DIRECT.find((entry) => entry.code === e.code);
      if (action) {
        e.preventDefault();
        go(action.to);
      }
    };

    const onHelp = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUTS_HELP_EVENT, onHelp);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUTS_HELP_EVENT, onHelp);
    };
  }, [navigate]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t.title} description={t.description}>
      <div className="space-y-6 text-sm">
        <section>
          <h3 className="text-xs font-semibold text-ink-soft">{t.do}</h3>
          <ul className="mt-1.5 divide-y divide-line">
            {DIRECT.map((entry) => (
              <Row key={entry.code} label={t[entry.label]} combos={[[entry.cap]]} />
            ))}
            {/* Ctrl+K / ⌘K is the palette's own; "/" is the one-key way to it. */}
            <Row label={t.search} combos={[isMac ? ["⌘", "K"] : [t.keyCtrl, "K"], ["/"]]} joiner={t.or} />
            <Row label={t.quickLook} combos={[[t.keySpace]]} />
            <Row label={t.focus} combos={[["F"]]} />
            <Row label={t.close} combos={[[t.keyEsc]]} />
            <Row label={t.help} combos={[["?"]]} />
          </ul>
        </section>
        <section>
          <h3 className="text-xs font-semibold text-ink-soft">{t.go}</h3>
          <ul className="mt-1.5 grid gap-x-8 sm:grid-cols-2">
            {GO.map((entry) => (
              <Row key={entry.code} label={t[entry.label]} combos={[["G"], [entry.cap]]} joiner={t.then} />
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}

/**
 * One shortcut. `combos` are the key groups in the order they are read, with
 * `joiner` between them («وبعدها» for a sequence, «أو» for another way). The
 * groups follow the page's direction, so an Arabic reader meets G before the
 * letter; the keys held together inside one group (⌘ K) always read left to
 * right, as they are written everywhere.
 */
function Row({ label, combos, joiner }: { label: string; combos: string[][]; joiner?: string }) {
  return (
    <li className="flex min-h-10 items-center justify-between gap-3 py-1.5">
      {/* Wraps rather than cuts: a shortcut with half a name is no use. */}
      <span className="min-w-0 leading-5 text-ink">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {combos.map((keys, index) => (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && joiner && <span className="text-xs text-ink-soft">{joiner}</span>}
            <span dir="ltr" className="inline-flex items-center gap-1">
              {keys.map((key) => (
                <Key key={key}>{key}</Key>
              ))}
            </span>
          </span>
        ))}
      </span>
    </li>
  );
}
