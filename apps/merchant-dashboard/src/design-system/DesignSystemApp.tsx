import { useEffect, useState, type CSSProperties } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  Check,
  ChevronDown,
  Layers,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GlassButton,
  GlassDialogContent,
  GlassDropdownMenuContent,
  GlassPanel,
  Input,
  Spinner,
  cn,
} from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { LocaleProvider, useLocale, useT } from "@/i18n/LocaleContext";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider, useToast } from "@/components/Toast";
import { ZimosLogo } from "@/components/ZimosLogo";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { DataTable, type Column } from "@/components/DataTable";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { NAV_LABELS } from "@/lib/navigation";
import { LAB_MESSAGES } from "./messages";
import { LAB_NAV, COMMERCE_ICONS } from "./icon-map";
import "@store-builder/ui/styles.css";
import "./lab.css";

const TOKENS = [
  "primary",
  "primary-soft",
  "paper",
  "paper-raised",
  "ink",
  "ink-soft",
  "line",
  "line-strong",
  "success",
  "danger",
  "accent",
] as const;
type State = "ready" | "loading" | "empty" | "error" | "permission";
type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
type Order = {
  id: string;
  name: "sara" | "nour" | "mona" | "omar";
  city: "cairo" | "giza" | "alex";
  status: OrderStatus;
  amountMinor: number;
};
const ORDERS: readonly Order[] = [
  {
    id: "ZM-1048",
    name: "sara",
    city: "cairo",
    status: "pending",
    amountMinor: 125000,
  },
  {
    id: "ZM-1047",
    name: "nour",
    city: "giza",
    status: "confirmed",
    amountMinor: 89000,
  },
  {
    id: "ZM-1046",
    name: "mona",
    city: "alex",
    status: "delivered",
    amountMinor: 234000,
  },
  {
    id: "ZM-1045",
    name: "omar",
    city: "cairo",
    status: "cancelled",
    amountMinor: 76000,
  },
];

function LiveTokens() {
  const t = useT(LAB_MESSAGES);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(
          TOKENS.map((token) => [
            token,
            css.getPropertyValue(`--color-${token}`).trim(),
          ]),
        ),
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <Section title={t.colors} description={t.colorsDesc}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {TOKENS.map((token) => (
          <div
            key={token}
            className="overflow-hidden rounded-lg border border-line bg-paper-raised"
          >
            <div
              aria-hidden
              className="lab-swatch h-12 border-b border-line"
              style={{ "--swatch": `var(--color-${token})` } as CSSProperties}
            />
            <div className="space-y-1 p-3 text-xs">
              <code dir="ltr" className="block font-medium">
                {token}
              </code>
              <code dir="ltr" className="block text-ink-soft">
                {values[token]}
              </code>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DialogExample() {
  const t = useT(LAB_MESSAGES);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="primary" className="min-h-11" />}>
        <Plus className="size-4" aria-hidden />
        {t.openDialog}
      </DialogTrigger>
      <GlassDialogContent showCloseButton={false}>
        <DialogHeader className="pe-8">
          <DialogTitle>{t.dialogTitle}</DialogTitle>
          <DialogDescription>{t.dialogDesc}</DialogDescription>
        </DialogHeader>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute end-3 top-3 min-h-11 min-w-11"
            />
          }
          aria-label={t.close}
        >
          <X className="size-4" aria-hidden />
        </DialogClose>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
            toast.success(t.toast);
          }}
        >
          <Card className="gap-4 p-4">
            <TextField
              label={t.storeName}
              defaultValue="ZIMOS Demo"
              required
              hint={t.storeHint}
            />
            <TextField
              label={t.email}
              type="email"
              defaultValue="hello@example.com"
              required
              dir="ltr"
            />
          </Card>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" className="min-h-11" />}
              type="button"
            >
              {t.cancel}
            </DialogClose>
            <Button type="submit" className="min-h-11">
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </GlassDialogContent>
    </Dialog>
  );
}

function Lab() {
  const t = useT(LAB_MESSAGES);
  const navLabels = useT(NAV_LABELS);
  const { dir, intlLocale } = useLocale();
  const toast = useToast();
  const [glass, setGlass] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("orders");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [state, setState] = useState<State>("ready");
  const [method, setMethod] = useState("cod");

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.getAttribute("data-glass");
    html.setAttribute("data-glass", glass ? "on" : "off");
    return () => {
      if (previous === null) html.removeAttribute("data-glass");
      else html.setAttribute("data-glass", previous);
    };
  }, [glass]);

  const money = (minor: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(minor / 100);
  const rows = ORDERS.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      `${row.id} ${t[row.name]}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const columns: Column<Order>[] = [
    {
      key: "id",
      header: t.order,
      cell: (row) => (
        <span dir="ltr" className="font-medium tabular-nums">
          {row.id}
        </span>
      ),
    },
    { key: "name", header: t.customer, cell: (row) => t[row.name] },
    { key: "city", header: t.city, cell: (row) => t[row.city] },
    {
      key: "status",
      header: t.status,
      cell: (row) => <StatusBadge value={row.status} text={t[row.status]} />,
    },
    {
      key: "amount",
      header: t.amount,
      align: "end",
      cell: (row) => (
        <span className="font-medium tabular-nums">
          {money(row.amountMinor)}
        </span>
      ),
    },
  ];
  const navigation = (
    <nav aria-label={t.nav} className="space-y-1">
      {LAB_NAV.map(({ id, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={activeSection === id ? "location" : undefined}
          onClick={() => {
            setActiveSection(id);
            setNavOpen(false);
          }}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
            activeSection === id
              ? "bg-primary-soft text-primary-dark dark:text-primary"
              : "text-ink-soft hover:bg-muted hover:text-ink",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          {t[id]}
        </a>
      ))}
    </nav>
  );
  const reset = () => {
    setQuery("");
    setStatus("all");
  };

  return (
    <DirectionProvider direction={dir}>
      <div className="ui-lab">
        <a
          href="#lab-main"
          className="sr-only z-50 rounded-lg bg-paper-raised p-4 text-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {t.skip}
        </a>
        <div className="mx-auto grid max-w-[1440px] gap-6 p-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:p-6">
          <aside className="hidden lg:block">
            <GlassPanel
              purpose="navigation"
              className="sticky top-6 flex min-h-[calc(100dvh-3rem)] flex-col p-4"
            >
              <div className="px-3 py-3">
                <ZimosLogo height={28} />
                <p className="mt-3 text-xs text-ink-soft">{t.version}</p>
              </div>
              <div className="mt-5">{navigation}</div>
              <div className="mt-auto space-y-3 border-t border-line px-3 pt-5">
                <StatusBadge value="draft" text={t.development} />
                <p className="text-xs leading-relaxed text-ink-soft">
                  {t.demo}
                </p>
              </div>
            </GlassPanel>
          </aside>
          <div className="min-w-0">
            <GlassPanel
              purpose="navigation"
              className="sticky top-4 z-20 mb-8 flex flex-wrap items-center justify-between gap-3 p-3 lg:top-6"
            >
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 lg:hidden"
                  onClick={() => setNavOpen(!navOpen)}
                  aria-expanded={navOpen}
                  aria-controls="lab-mobile-nav"
                  aria-label={navOpen ? t.close : t.menu}
                >
                  <Menu className="size-5" aria-hidden />
                </Button>
                <Layers
                  className="hidden size-[18px] text-primary sm:block"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="text-sm font-semibold">{t.lab}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GlassButton
                  className="min-h-11"
                  aria-pressed={glass}
                  onClick={() => setGlass(!glass)}
                >
                  <Layers className="size-4" aria-hidden />
                  {glass ? t.glassOn : t.glassOff}
                </GlassButton>
                <LanguageSwitch className="min-h-11" />
                <ThemeToggle className="min-h-11 min-w-11" />
              </div>
              {navOpen && (
                <div
                  id="lab-mobile-nav"
                  className="w-full border-t border-line pt-3 lg:hidden"
                >
                  {navigation}
                </div>
              )}
            </GlassPanel>
            <main id="lab-main" tabIndex={-1} className="space-y-8 pb-10">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge value="active" text={t.approved} />
                  <StatusBadge value="pending" text={t.proposal} />
                </div>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                  {t.intro}
                </p>
              </div>
              <section
                id="orders"
                className="space-y-4"
                aria-labelledby="orders-title"
              >
                <div id="orders-title">
                  <PageHeader
                    title={t.orders}
                    description={t.ordersDesc}
                    actions={<DialogExample />}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <KpiCard
                    label={t.total}
                    value={new Intl.NumberFormat(intlLocale).format(
                      ORDERS.length,
                    )}
                    hint={t.sample}
                  />
                  <KpiCard
                    label={t.revenue}
                    value={money(
                      ORDERS.reduce(
                        (sum, row) =>
                          sum +
                          (row.status === "cancelled" ? 0 : row.amountMinor),
                        0,
                      ),
                    )}
                    hint={t.sample}
                  />
                  <KpiCard
                    label={t.pending}
                    value={new Intl.NumberFormat(intlLocale).format(
                      ORDERS.filter((row) => row.status === "pending").length,
                    )}
                    hint={t.sample}
                  />
                </div>
                <Section
                  title={t.orders}
                  description={t.demo}
                  flush
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<GlassButton className="min-h-11" />}
                      >
                        {t.quickActions}
                        <ChevronDown className="size-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <GlassDropdownMenuContent
                        align="end"
                        className="min-w-48"
                      >
                        <DropdownMenuItem
                          onClick={() => toast.success(t.toast)}
                        >
                          <Check className="size-4" aria-hidden />
                          {t.showToast}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={reset}>
                          {t.reset}
                        </DropdownMenuItem>
                      </GlassDropdownMenuContent>
                    </DropdownMenu>
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pb-4">
                    <div className="relative w-full sm:max-w-xs">
                      <label className="sr-only" htmlFor="lab-order-search">
                        {t.search}
                      </label>
                      <Search
                        className="pointer-events-none absolute start-3 top-3 size-4 text-ink-soft"
                        aria-hidden
                      />
                      <Input
                        id="lab-order-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t.placeholder}
                        className="min-h-11 ps-9"
                      />
                    </div>
                    <FilterTabs
                      value={status}
                      onChange={setStatus}
                      label={t.filter}
                      tabs={[
                        { value: "all", label: t.all },
                        { value: "pending", label: t.pending },
                        { value: "confirmed", label: t.confirmed },
                        { value: "delivered", label: t.delivered },
                      ]}
                    />
                  </div>
                  <div className="p-3">
                    <DataTable
                      columns={columns}
                      rows={rows}
                      rowKey={(row) => row.id}
                      minWidth="36rem"
                      empty={
                        <EmptyState
                          title={t.noMatches}
                          description={t.noMatchesDesc}
                          action={
                            <Button variant="outline" onClick={reset}>
                              {t.reset}
                            </Button>
                          }
                        />
                      }
                    />
                  </div>
                </Section>
              </section>

              <section
                id="foundation"
                className="space-y-4"
                aria-labelledby="foundation-title"
              >
                <h2 id="foundation-title" className="text-xl font-semibold">
                  {t.foundation}
                </h2>
                <LiveTokens />
                <div className="grid gap-4 xl:grid-cols-2">
                  <Section title={t.type} description={t.typeDesc}>
                    <h3 className="text-2xl font-semibold">{t.heading}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                      {t.body}
                    </p>
                    <p className="mt-3 text-2xl font-semibold tabular-nums">
                      {money(125000)}
                    </p>
                  </Section>
                  <Section title={t.scale} description={t.scaleDesc}>
                    <div className="flex flex-wrap items-end gap-4">
                      {[1, 2, 3, 4, 6, 8].map((step) => (
                        <div key={step} className="space-y-2 text-center">
                          <div
                            className="rounded-sm bg-primary-soft"
                            style={{
                              width: `${step * 0.25}rem`,
                              height: `${step * 0.25}rem`,
                            }}
                            aria-hidden
                          />
                          <code className="text-xs text-ink-soft" dir="ltr">
                            {step * 4}px
                          </code>
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>
              </section>

              <section
                id="components"
                className="space-y-4"
                aria-labelledby="components-title"
              >
                <h2 id="components-title" className="text-xl font-semibold">
                  {t.components}
                </h2>
                <Section title={t.actions} description={t.actionsDesc}>
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        "primary",
                        "secondary",
                        "outline",
                        "ghost",
                        "danger",
                      ] as const
                    ).map((variant) => (
                      <Button
                        key={variant}
                        variant={variant}
                        className="min-h-11"
                        onClick={() => toast.success(t.toast)}
                      >
                        {t[variant]}
                      </Button>
                    ))}
                    <Button disabled className="min-h-11">
                      {t.disabled}
                    </Button>
                    <Button disabled variant="outline" className="min-h-11">
                      <Spinner aria-hidden />
                      {t.saving}
                    </Button>
                  </div>
                </Section>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Section title={t.fields} description={t.fieldsDesc}>
                    <div className="space-y-4">
                      <TextField
                        label={t.storeName}
                        defaultValue="ZIMOS Demo"
                        hint={t.storeHint}
                      />
                      <TextField
                        label={t.email}
                        value="hello@"
                        readOnly
                        error={t.validation}
                        dir="ltr"
                      />
                      <Field label={t.method}>
                        {({ id }) => (
                          <Select
                            id={id}
                            value={method}
                            onChange={(event) => setMethod(event.target.value)}
                          >
                            <option value="cod">{t.cod}</option>
                            <option value="card">{t.card}</option>
                          </Select>
                        )}
                      </Field>
                    </div>
                  </Section>
                  <Section title={t.badges} description={t.badgesDesc}>
                    <div className="flex flex-wrap gap-3">
                      {(
                        [
                          "pending",
                          "confirmed",
                          "delivered",
                          "cancelled",
                        ] as const
                      ).map((value) => (
                        <StatusBadge
                          key={value}
                          value={value}
                          text={t[value]}
                        />
                      ))}
                    </div>
                    <div className="mt-6 border-t border-line pt-4">
                      <h3 className="text-sm font-semibold">{t.icons}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {t.iconsDesc}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {COMMERCE_ICONS.map(({ key, icon: Icon }) => (
                          <div
                            key={key}
                            className="flex flex-col items-center gap-2 rounded-lg border border-line p-3 text-center"
                          >
                            <Icon size={18} strokeWidth={1.75} aria-hidden />
                            <span className="text-xs text-ink-soft">
                              {navLabels[key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Section>
                </div>
              </section>

              <section
                id="material"
                className="space-y-4"
                aria-labelledby="material-title"
              >
                <h2 id="material-title" className="text-xl font-semibold">
                  {t.material}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
                  {t.materialDesc}
                </p>
                <div className="lab-glass-stage grid gap-5 rounded-[var(--radius-card)] border border-line p-5 md:grid-cols-2 sm:p-8">
                  <GlassPanel
                    purpose="floating"
                    className="flex flex-col justify-between gap-6 p-5"
                  >
                    <div>
                      <span className="text-xs font-medium text-primary">
                        {glass ? t.translucent : t.opacity}
                      </span>
                      <h3 className="mt-3 text-xl font-semibold">
                        {t.glassTitle}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        {t.glassBody}
                      </p>
                    </div>
                    <GlassButton
                      className="min-h-11 w-fit"
                      onClick={() => toast.success(t.toast)}
                    >
                      {t.floating}
                    </GlassButton>
                  </GlassPanel>
                  <Card className="justify-center gap-4 p-5">
                    <StatusBadge value="active" text={t.opacity} />
                    <TextField label={t.customer} value={t.sara} readOnly />
                    <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
                      <span className="text-ink-soft">{t.amount}</span>
                      <span className="font-semibold tabular-nums">
                        {money(125000)}
                      </span>
                    </div>
                  </Card>
                </div>
              </section>

              <section
                id="states"
                className="space-y-4"
                aria-labelledby="states-title"
              >
                <h2 id="states-title" className="text-xl font-semibold">
                  {t.states}
                </h2>
                <p className="text-sm text-ink-soft">{t.stateDesc}</p>
                <FilterTabs
                  label={t.stateFilter}
                  value={state}
                  onChange={setState}
                  tabs={(
                    [
                      "ready",
                      "loading",
                      "empty",
                      "error",
                      "permission",
                    ] as const
                  ).map((value) => ({ value, label: t[value] }))}
                />
                <Card className="min-h-60 p-5">
                  <DataState
                    loading={state === "loading"}
                    error={
                      state === "permission"
                        ? new ApiError("Forbidden", 403, "FORBIDDEN")
                        : state === "error"
                          ? new ApiError("Unavailable", 0)
                          : null
                    }
                    onRetry={() => setState("ready")}
                  >
                    {state === "empty" ? (
                      <EmptyState
                        title={t.emptyTitle}
                        description={t.emptyBody}
                      />
                    ) : (
                      <DataTable
                        columns={columns}
                        rows={ORDERS.slice(0, 2)}
                        rowKey={(row) => row.id}
                        minWidth="36rem"
                      />
                    )}
                  </DataState>
                </Card>
                <Section title={t.skeletonTitle} description={t.skeletonDesc}>
                  <div
                    role="status"
                    aria-label={t.skeleton}
                    className="space-y-3"
                  >
                    <div
                      aria-hidden
                      className="lab-skeleton h-5 w-1/3 rounded-md bg-muted"
                    />
                    <div
                      aria-hidden
                      className="lab-skeleton h-4 w-2/3 rounded-md bg-muted"
                    />
                    <div
                      aria-hidden
                      className="lab-skeleton h-16 rounded-lg bg-muted"
                    />
                  </div>
                </Section>
              </section>
              <Card className="gap-3 p-6">
                <h2 className="text-lg font-semibold">{t.rules}</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
                  {t.rulesDesc}
                </p>
              </Card>
            </main>
          </div>
        </div>
      </div>
    </DirectionProvider>
  );
}

export default function DesignSystemApp() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <Lab />
      </ToastProvider>
    </LocaleProvider>
  );
}
