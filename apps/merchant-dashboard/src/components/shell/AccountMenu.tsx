import { profileAvatarOf } from "@store-builder/api-client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@store-builder/ui";
import { IconKeyboard, IconSettings, IconSignOut } from "@/components/icons";
import { SHORTCUTS_HELP_EVENT } from "@/components/KeyboardShortcuts";
import { useAuth } from "@/context/AuthContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useViewNavigate } from "@/lib/viewTransition";

const STRINGS = {
  en: {
    accountMenu: "Account menu",
    settings: "Settings",
    shortcuts: "Keyboard shortcuts",
    signOut: "Sign out",
  },
  ar: {
    accountMenu: "قائمة الحساب",
    settings: "الإعدادات",
    shortcuts: "اختصارات الكيبورد",
    signOut: "تسجيل الخروج",
  },
} satisfies Messages;

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the menu's own corners. */
const ITEM = "min-h-9 cursor-pointer gap-2.5 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";

function Avatar({ src, letter, className }: { src: string | null; letter: string; className: string }) {
  return src ? (
    <img src={src} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden
      className={`${className} zimos-store-tile flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground!`}
    >
      {letter}
    </span>
  );
}

/**
 * Who is signed in, at the end of the toolbar. The avatar opens the account
 * menu: settings, the keyboard shortcuts and sign out — which is why there is
 * no sign-out button on show anywhere.
 */
export function AccountMenu() {
  const { logout, user } = useAuth();
  const navigate = useViewNavigate();
  const { dir } = useLocale();
  const t = useT(STRINGS);
  const userLabel = user?.fullName ?? user?.email ?? "";
  const avatar = profileAvatarOf(user);
  const letter = (Array.from(userLabel.trim())[0] ?? "?").toLocaleUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t.accountMenu}
            title={t.accountMenu}
            className="zimos-tool flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color,scale] duration-150 hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-paper-sunken motion-reduce:transition-none motion-reduce:active:scale-100 max-md:size-11 pointer-coarse:size-11"
          />
        }
      >
        <Avatar src={avatar} letter={letter} className="size-8 text-sm" />
      </DropdownMenuTrigger>
      {/* The avatar sits at the end of the bar; the menu hangs from that end (the menu itself does not know the page is RTL). */}
      <DropdownMenuContent side="bottom" align={dir === "rtl" ? "start" : "end"} sideOffset={10} className="min-w-64 rounded-[1.125rem] p-1.5">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <Avatar src={avatar} letter={letter} className="size-9 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{userLabel}</p>
            {user?.fullName && user.email && (
              <p className="truncate text-xs text-ink-soft" dir="ltr">
                {user.email}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="mx-1.5" />
        <DropdownMenuItem onClick={() => navigate("/settings")} className={ITEM}>
          <IconSettings className="size-[18px] text-ink-soft" aria-hidden />
          {t.settings}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.dispatchEvent(new Event(SHORTCUTS_HELP_EVENT))} className={ITEM}>
          <IconKeyboard className="size-[18px] text-ink-soft" aria-hidden />
          {t.shortcuts}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-1.5" />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()} className={ITEM}>
          <IconSignOut className="size-[18px] rtl:-scale-x-100" aria-hidden />
          {t.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
