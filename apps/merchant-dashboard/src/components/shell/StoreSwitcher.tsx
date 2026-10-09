import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@store-builder/ui";
import { IconCaretUpDown, IconCheck, IconPlus, IconStore, IconTeam } from "@/components/icons";
import { InviteCountBadge, useInviteCount, useInvitesLabel } from "@/components/account/InvitesLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useViewNavigate } from "@/lib/viewTransition";

const STRINGS = {
  en: {
    selectStore: "Select a store",
    switchStore: "Switch store",
    switchStoreNamed: "{name} — switch store",
    myStores: "My stores",
    currentStore: "(open now)",
    allStores: "All my stores",
    newStore: "New store",
  },
  ar: {
    selectStore: "اختار متجر",
    switchStore: "تبديل المتجر",
    switchStoreNamed: "{name} — تبديل المتجر",
    myStores: "متاجري",
    currentStore: "(مفتوح دلوقتي)",
    allStores: "كل متاجري",
    newStore: "متجر جديد",
  },
} satisfies Messages;

/** The letter on a store's tile: its first character (a whole one, also for a name that starts with an emoji). */
function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase();
}

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the menu's own corners. */
const ITEM = "min-h-9 cursor-pointer gap-2.5 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";
/** The letter stays white on the brand tile while its line is highlighted (the shared menu item recolours what is inside it). */
const TILE = "zimos-store-tile flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground!";

interface StoreSwitcherProps {
  /** Called before the switcher leaves for another page (the phone menu closes itself). */
  onNavigate?: () => void;
  /** `md` — the compact row of the side menu. `lg` — the roomier row at the top of the phone menu. */
  size?: "md" | "lg";
  className?: string;
}

/**
 * The store being worked on, as one compact row: its tile (the first letter on
 * the brand colour), its name and a caret. Behind it, on the shared menu
 * (arrow keys, type-ahead, Esc and focus return for free): the merchant's
 * stores with a tick on the one that is open, then every store and a new one.
 */
export function StoreSwitcher({ onNavigate, size = "md", className }: StoreSwitcherProps) {
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useViewNavigate();
  const t = useT(STRINGS);
  const name = currentWorkspace?.name ?? t.selectStore;
  // Team invitations waiting for this account (handoff 358): a count here, and a line in the menu.
  const inviteCount = useInviteCount();
  const invitesLabel = useInvitesLabel();
  const large = size === "lg";

  function go(to: string) {
    onNavigate?.();
    navigate(to);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={currentWorkspace ? fmt(t.switchStoreNamed, { name: currentWorkspace.name }) : t.switchStore}
            title={t.switchStore}
            className={cn(
              "zimos-store-switch flex w-full cursor-pointer items-center text-start transition-[background-color,scale] duration-150 hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98] aria-expanded:bg-paper-sunken motion-reduce:transition-none motion-reduce:active:scale-100",
              large
                ? "h-14 gap-3 rounded-[1.25rem] bg-paper-sunken ps-2 pe-3.5"
                : "h-11 gap-2.5 rounded-[1rem] bg-paper ps-1.5 pe-2.5 ring-1 ring-line",
              className
            )}
          />
        }
      >
        <span aria-hidden className={cn(TILE, large ? "size-10 rounded-[0.75rem] text-base" : "size-8 rounded-[0.625rem] text-sm")}>
          {initialOf(name)}
        </span>
        <span className={cn("min-w-0 flex-1 truncate font-semibold text-ink", large ? "text-[15px]" : "text-sm")}>{name}</span>
        <InviteCountBadge count={inviteCount} />
        <IconCaretUpDown className="size-4 shrink-0 text-ink-soft" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="bottom" align="start" sideOffset={6} className="max-h-[min(24rem,var(--available-height))] min-w-56 rounded-[1.125rem] p-1.5">
        {workspaces.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-ink-soft">{t.myStores}</DropdownMenuLabel>
              {workspaces.map((workspace) => {
                const isCurrent = workspace.id === currentWorkspace?.id;
                return (
                  <DropdownMenuItem key={workspace.id} onClick={() => selectWorkspace(workspace.id)} className={ITEM}>
                    <span aria-hidden className={cn(TILE, "size-6 rounded-[0.4375rem] text-[11px]")}>
                      {initialOf(workspace.name)}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", isCurrent ? "font-semibold text-ink" : "text-ink")}>{workspace.name}</span>
                    {isCurrent && (
                      <>
                        <IconCheck weight="bold" className="size-4 text-primary" aria-hidden />
                        <span className="sr-only">{t.currentStore}</span>
                      </>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="mx-1.5" />
          </>
        )}
        <DropdownMenuItem onClick={() => go("/stores")} className={ITEM}>
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
            <IconStore className="size-[18px] text-ink-soft" />
          </span>
          {t.allStores}
        </DropdownMenuItem>
        {inviteCount > 0 && (
          <DropdownMenuItem onClick={() => go("/invites")} className={ITEM}>
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
              <IconTeam className="size-[18px] text-ink-soft" />
            </span>
            <span className="min-w-0 flex-1">{invitesLabel}</span>
            <InviteCountBadge count={inviteCount} />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => go("/workspaces")} className={ITEM}>
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
            <IconPlus className="size-[18px] text-ink-soft" />
          </span>
          {t.newStore}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
