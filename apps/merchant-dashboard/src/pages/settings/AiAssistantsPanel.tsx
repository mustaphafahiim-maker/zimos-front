import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconCheck, IconCopy, IconInfo } from "@/components/icons";
import { Alert, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@store-builder/ui";
import {
  MCP_DEFAULT_SCOPES,
  MCP_TOOLS,
  mcpCreateApiKey,
  mcpServerUrl,
  type McpApiKeyScope,
  type McpToolName,
} from "@store-builder/api-client";
import { apiClient, apiBaseUrl } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";

/**
 * Settings → Developers → "AI assistants (MCP)" (handoff item 179): the
 * store's MCP server, which Claude, ChatGPT or any MCP client uses with a
 * store API key. Shows the server URL, what the assistant can do, and the
 * setup for each assistant; "Create a key for AI" makes a key with the MCP
 * scopes ticked (editable).
 *
 * The key is shown once, in the answer that created it — together with the
 * setups already filled in with it, since that is the only moment they can
 * be. Before and after, the setups carry a `<API key>` placeholder.
 */

const KEY_PLACEHOLDER = "<API key>";

const STRINGS = {
  en: {
    title: "AI assistants (MCP)",
    intro: "Let Claude, ChatGPT or another assistant work with your store using an API key.",
    createKey: "Create a key for AI",
    serverUrl: "Server URL",
    copy: "Copy",
    copied: "Copied",
    copyWhat: "Copy {what}",
    toolsTitle: "What the assistant can do",
    needs: "Needs: {scope}",
    tool_list_products: "Lists your products with their variants, prices and stock.",
    tool_list_orders: "Lists recent orders, by order number, name, phone or date.",
    tool_get_order: "Opens one order in full: products, customer, address, payments and shipments.",
    tool_check_pages: "Checks your funnels for problems before you publish them.",
    tool_create_draft_funnel: "Creates a new funnel as a draft.",
    drafts: "Funnels it creates stay drafts until you publish them.",
    setupTitle: "Connect your assistant",
    setupHint: "Copy the setup for your assistant and put your key where it says {key}.",
    tabsLabel: "Assistant",
    claudeCodeCommand: "Run this in a terminal:",
    claudeCodeFile: "Or add it to the project's {file} file:",
    claudeDesktop:
      "Paste into {file} (Settings → Developer → Edit Config), then restart Claude. It connects through the {helper} helper, which needs Node.js on your computer.",
    chatgpt: "Give ChatGPT, or any MCP client, the server URL and send the key in the Authorization header:",
    openai: "With the OpenAI API (Responses), add this tool to your request:",
    terminal: "Terminal",
    header: "Header",
    // The key dialog
    keyName: "Name",
    keyNameDefault: "AI assistant",
    keyNameHint: "Which assistant uses it, e.g. “Claude on my laptop”.",
    access: "What it may do",
    accessHint: "Untick anything it doesn't need. Your role in the store must allow it too.",
    "scope_products:read": "Read products and stock",
    "scope_orders:read": "Read orders",
    "scope_funnels:read": "Check funnels for problems",
    "scope_funnels:write": "Create draft funnels",
    needScope: "Choose at least one.",
    create: "Create key",
    creating: "Creating…",
    cancel: "Cancel",
    done: "Done",
    keyCreatedTitle: "Copy your key and setup",
    keyCreatedBody:
      "This is the only time the key is shown — the setups below already contain it. Keep it somewhere safe; if it's lost, revoke it and create another.",
    apiKey: "API key",
  },
  ar: {
    title: "مساعدين الذكاء الاصطناعي (MCP)",
    intro: "خلي Claude أو ChatGPT أو أي مساعد يشتغل على متجرك بمفتاح API.",
    createKey: "اعمل مفتاح للذكاء الاصطناعي",
    serverUrl: "رابط السيرفر",
    copy: "نسخ",
    copied: "اتنسخ",
    copyWhat: "انسخ {what}",
    toolsTitle: "المساعد يقدر يعمل إيه",
    needs: "محتاج: {scope}",
    tool_list_products: "بيعرض منتجاتك بأنواعها وأسعارها والمخزون.",
    tool_list_orders: "بيعرض آخر الأوردرات، برقم الأوردر أو الاسم أو التليفون أو التاريخ.",
    tool_get_order: "بيفتح أوردر واحد بالتفصيل: المنتجات والعميل والعنوان والدفع والشحنات.",
    tool_check_pages: "بيراجع مسارات البيع بتاعتك ويطلّع المشاكل قبل ما تنشرها.",
    tool_create_draft_funnel: "بيعمل مسار بيع جديد كمسودة.",
    drafts: "مسارات البيع اللي بيعملها بتفضل مسودة لحد ما تنشرها انت.",
    setupTitle: "اربط المساعد بتاعك",
    setupHint: "انسخ الإعداد اللي يناسب المساعد بتاعك، وحط المفتاح مكان {key}.",
    tabsLabel: "المساعد",
    claudeCodeCommand: "شغّل ده في الـ Terminal:",
    claudeCodeFile: "أو ضيفه في ملف {file} بتاع المشروع:",
    claudeDesktop:
      "الصقه في ملف {file} (الإعدادات ← Developer ← Edit Config)، وبعدين اقفل Claude وافتحه تاني. بيتصل عن طريق أداة {helper}، ومحتاجة Node.js على جهازك.",
    chatgpt: "ادّي ChatGPT، أو أي برنامج MCP، رابط السيرفر، وابعت المفتاح في الـ Authorization header:",
    openai: "لو بتستخدم OpenAI API (Responses)، ضيف الأداة دي للطلب:",
    terminal: "Terminal",
    header: "الـ Header",
    keyName: "الاسم",
    keyNameDefault: "مساعد الذكاء الاصطناعي",
    keyNameHint: "أنهي مساعد هيستخدمه، مثلاً «Claude على اللابتوب».",
    access: "يقدر يعمل إيه",
    accessHint: "شيل العلامة من أي حاجة مش محتاجها. ولازم دورك في المتجر يسمح بيها كمان.",
    "scope_products:read": "قراءة المنتجات والمخزون",
    "scope_orders:read": "قراءة الأوردرات",
    "scope_funnels:read": "مراجعة مشاكل مسارات البيع",
    "scope_funnels:write": "عمل مسارات بيع مسودة",
    needScope: "اختار حاجة واحدة على الأقل.",
    create: "اعمل المفتاح",
    creating: "بيتعمل…",
    cancel: "إلغاء",
    done: "تمام",
    keyCreatedTitle: "انسخ المفتاح والإعداد",
    keyCreatedBody:
      "دي المرة الوحيدة اللي المفتاح هيظهر فيها — والإعدادات اللي تحت فيها المفتاح جاهز. احفظه في مكان آمن؛ لو ضاع، الغيه واعمل واحد جديد.",
    apiKey: "مفتاح الـ API",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

/** The scopes offered in the key dialog, in the order shown. */
const OFFERED: readonly McpApiKeyScope[] = MCP_DEFAULT_SCOPES;

const scopeLabel = (t: T, scope: McpApiKeyScope) => (t as Record<string, string>)[`scope_${scope}`] ?? scope;

const toolText = (t: T, name: McpToolName) => t[`tool_${name}`];

/** The server's name in the assistant's config: the store's slug when it is a safe name. */
function useServerName(): string {
  const { currentWorkspace } = useWorkspace();
  const slug = (currentWorkspace?.slug ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "my-store";
}

export function AiAssistantsPanel({ onKeyCreated }: { onKeyCreated: () => void }) {
  const t = useT(STRINGS);
  const serverName = useServerName();
  const url = mcpServerUrl(apiBaseUrl, window.location.origin);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{t.title}</h3>
          <p className="text-sm text-ink-soft">{t.intro}</p>
        </div>
        <Button className="min-h-11 sm:min-h-9" onClick={() => setCreating(true)}>
          {t.createKey}
        </Button>
      </div>

      <div className="mt-3 space-y-5">
        <div className="rounded-md border border-line p-3">
          <p className="text-xs font-medium text-ink-soft">{t.serverUrl}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-sm text-ink" data-testid="mcp-server-url">
              {url}
            </code>
            <CopyText t={t} value={url} label={fmt(t.copyWhat, { what: t.serverUrl })} />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-ink">{t.toolsTitle}</h4>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line">
            {MCP_TOOLS.map((tool) => (
              <li key={tool.name} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <code dir="ltr" className="font-mono text-sm text-ink">
                    {tool.name}
                  </code>
                  <span className="rounded-[var(--radius-pill)] bg-paper-sunken px-2 py-0.5 text-xs text-ink-soft">
                    {fmt(t.needs, { scope: scopeLabel(t, tool.scopes[0]) })}
                  </span>
                </div>
                <p className="text-sm text-ink-soft">{toolText(t, tool.name)}</p>
              </li>
            ))}
          </ul>
          <Alert variant="info" className="mt-3 text-start">
            <IconInfo aria-hidden />
            <span>{t.drafts}</span>
          </Alert>
        </div>

        <div>
          <h4 className="text-sm font-medium text-ink">{t.setupTitle}</h4>
          <p className="text-sm text-ink-soft">
            <WithCode text={t.setupHint} values={{ key: KEY_PLACEHOLDER }} />
          </p>
          <McpSetup t={t} url={url} serverName={serverName} apiKey={null} />
        </div>
      </div>

      <AiKeyModal
        t={t}
        open={creating}
        url={url}
        serverName={serverName}
        onClose={() => setCreating(false)}
        onCreated={onKeyCreated}
      />
    </div>
  );
}

// ───────────────────────────── setups ─────────────────────────────

type SetupTab = "claudeCode" | "claudeDesktop" | "chatgpt";

/** The copy-ready setup for each assistant; `apiKey` null shows the placeholder. */
function McpSetup({ t, url, serverName, apiKey }: { t: T; url: string; serverName: string; apiKey: string | null }) {
  const [tab, setTab] = useState<SetupTab>("claudeCode");
  const key = apiKey ?? KEY_PLACEHOLDER;
  const bearer = `Bearer ${key}`;
  const json = (value: unknown) => JSON.stringify(value, null, 2);

  const claudeCommand = `claude mcp add --transport http ${serverName} ${url} --header "Authorization: ${bearer}"`;
  const mcpJson = json({ mcpServers: { [serverName]: { type: "http", url, headers: { Authorization: bearer } } } });
  const desktopJson = json({
    mcpServers: {
      [serverName]: {
        command: "npx",
        args: ["-y", "mcp-remote", url, "--header", "Authorization:${ZIMOS_AUTH}"],
        env: { ZIMOS_AUTH: bearer },
      },
    },
  });
  const openaiJson = json({ type: "mcp", server_label: serverName, server_url: url, headers: { Authorization: bearer } });

  const tabs: Array<{ value: SetupTab; label: string }> = [
    { value: "claudeCode", label: "Claude Code" },
    { value: "claudeDesktop", label: "Claude Desktop" },
    { value: "chatgpt", label: "ChatGPT" },
  ];

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as SetupTab)} className="mt-2">
      <TabsList aria-label={t.tabsLabel} className="w-full max-w-full overflow-x-auto sm:w-fit group-data-horizontal/tabs:h-auto">
        {tabs.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="min-h-11 px-2.5 sm:px-4">
            <span dir="ltr">{item.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="claudeCode" className="space-y-3 pt-3">
        <p className="text-sm text-ink-soft">{t.claudeCodeCommand}</p>
        <Snippet t={t} label={t.terminal} file code={claudeCommand} />
        <p className="text-sm text-ink-soft">
          <WithCode text={t.claudeCodeFile} values={{ file: ".mcp.json" }} />
        </p>
        <Snippet t={t} label=".mcp.json" file code={mcpJson} />
      </TabsContent>
      <TabsContent value="claudeDesktop" className="space-y-3 pt-3">
        <p className="text-sm text-ink-soft">
          <WithCode text={t.claudeDesktop} values={{ file: "claude_desktop_config.json", helper: "mcp-remote" }} />
        </p>
        <Snippet t={t} label="claude_desktop_config.json" file code={desktopJson} />
      </TabsContent>
      <TabsContent value="chatgpt" className="space-y-3 pt-3">
        <p className="text-sm text-ink-soft">{t.chatgpt}</p>
        <Snippet t={t} label={t.serverUrl} code={url} />
        <Snippet t={t} label={t.header} code={`Authorization: ${bearer}`} />
        <p className="text-sm text-ink-soft">{t.openai}</p>
        <Snippet t={t} label="tools[]" file code={openaiJson} />
      </TabsContent>
    </Tabs>
  );
}

/** A sentence with technical names (a file, a placeholder) kept left-to-right inside Arabic. */
function WithCode({ text, values }: { text: string; values: Record<string, string> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const value = /^\{(\w+)\}$/.test(part) ? values[part.slice(1, -1)] : undefined;
        return value === undefined ? (
          part
        ) : (
          <bdi key={i} dir="ltr">
            <code className="font-mono text-[0.92em] text-ink">{value}</code>
          </bdi>
        );
      })}
    </>
  );
}

/** A block of text to copy as-is: wraps instead of scrolling sideways on a phone. */
function Snippet({ t, label, code, file }: { t: T; label: string; code: string; file?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-paper-sunken">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1">
        <span dir={file ? "ltr" : "auto"} className={file ? "min-w-0 truncate font-mono text-xs text-ink-soft" : "min-w-0 truncate text-xs font-medium text-ink-soft"}>
          {label}
        </span>
        <CopyText t={t} value={code} label={fmt(t.copyWhat, { what: label })} />
      </div>
      <pre dir="ltr" className="whitespace-pre-wrap break-all p-3 text-start font-mono text-xs text-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Copies `value` and says so for a moment; the selection trick where the clipboard API is missing. */
function CopyText({ t, value, label }: { t: T; value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } catch {
        return;
      } finally {
        field.remove();
      }
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" size="sm" variant="ghost" className="min-h-11 shrink-0 sm:min-h-8" aria-label={label} title={label} onClick={copy}>
      {copied ? <IconCheck className="size-4 text-success" aria-hidden /> : <IconCopy className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? t.copied : t.copy}</span>
    </Button>
  );
}

// ───────────────────────────── key dialog ─────────────────────────────

function AiKeyModal({
  t,
  open,
  url,
  serverName,
  onClose,
  onCreated,
}: {
  t: T;
  open: boolean;
  url: string;
  serverName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(t.keyNameDefault);
  const [scopes, setScopes] = useState<McpApiKeyScope[]>([...MCP_DEFAULT_SCOPES]);
  const [scopeError, setScopeError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  // A fresh form each time it opens, named in the language shown now.
  useEffect(() => {
    if (!open) return;
    setName(t.keyNameDefault);
    setScopes([...MCP_DEFAULT_SCOPES]);
    setScopeError(undefined);
    setError(null);
    setSecret(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    // The key leaves memory with the dialog: it cannot be shown again.
    setSecret(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (scopes.length === 0) {
      setScopeError(t.needScope);
      return;
    }
    setBusy(true);
    try {
      // In the offered order, so the key's scopes read the same every time.
      const ordered = OFFERED.filter((scope) => scopes.includes(scope));
      const created = await mcpCreateApiKey(apiClient, workspaceId, { name: name.trim(), scopes: ordered });
      setSecret(created.secret);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (secret) {
    return (
      <Modal open={open} onClose={close} title={t.keyCreatedTitle} className="max-w-2xl" footer={<Button onClick={close}>{t.done}</Button>}>
        <p className="mb-3 text-sm text-ink-soft">{t.keyCreatedBody}</p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-2">
          <code dir="ltr" className="min-w-0 flex-1 select-all break-all font-mono text-xs text-ink" data-testid="mcp-key-secret">
            {secret}
          </code>
          <CopyText t={t} value={secret} label={fmt(t.copyWhat, { what: t.apiKey })} />
        </div>
        <h4 className="mt-5 text-sm font-medium text-ink">{t.setupTitle}</h4>
        <McpSetup t={t} url={url} serverName={serverName} apiKey={secret} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={t.createKey} description={t.intro}>
      <form onSubmit={submit} className="space-y-4">
        <TextField label={t.keyName} hint={t.keyNameHint} value={name} maxLength={150} required onChange={(e) => setName(e.target.value)} />
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-ink">{t.access}</legend>
          <p className="text-xs text-ink-soft">{t.accessHint}</p>
          <div className="divide-y divide-line rounded-md border border-line">
            {OFFERED.map((scope) => (
              <label key={scope} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={scopes.includes(scope)}
                  onChange={(e) => {
                    setScopes((prev) => (e.target.checked ? [...prev, scope] : prev.filter((s) => s !== scope)));
                    if (e.target.checked) setScopeError(undefined);
                  }}
                />
                <span className="min-w-0 flex-1 text-sm text-ink">{scopeLabel(t, scope)}</span>
                <code dir="ltr" className="shrink-0 font-mono text-[11px] text-ink-soft">
                  {scope}
                </code>
              </label>
            ))}
          </div>
          {scopeError && <p className="text-xs font-medium text-danger">{scopeError}</p>}
        </fieldset>
        <Alert variant="info" className="text-start">
          <IconInfo aria-hidden />
          <span>{t.drafts}</span>
        </Alert>
        {error && (
          <Alert variant="danger" className="text-start">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11 sm:min-h-9" disabled={busy || name.trim() === ""}>
            {busy ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
