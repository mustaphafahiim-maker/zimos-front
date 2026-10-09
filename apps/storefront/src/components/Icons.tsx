import type { ComponentProps, SVGProps } from "react";
import { ArrowRightIcon as ArrowRightGlyph } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpIcon as ArrowUpGlyph } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { ArrowUUpLeftIcon as ArrowUUpLeftGlyph } from "@phosphor-icons/react/dist/ssr/ArrowUUpLeft";
import { CaretDownIcon as CaretDownGlyph } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CheckIcon as CheckGlyph } from "@phosphor-icons/react/dist/ssr/Check";
import { CopyIcon as CopyGlyph } from "@phosphor-icons/react/dist/ssr/Copy";
import { CreditCardIcon as CreditCardGlyph } from "@phosphor-icons/react/dist/ssr/CreditCard";
import { GiftIcon as GiftGlyph } from "@phosphor-icons/react/dist/ssr/Gift";
import { ListIcon as ListGlyph } from "@phosphor-icons/react/dist/ssr/List";
import { MagnifyingGlassIcon as MagnifyingGlassGlyph } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MagnifyingGlassPlusIcon as MagnifyingGlassPlusGlyph } from "@phosphor-icons/react/dist/ssr/MagnifyingGlassPlus";
import { MoneyIcon as MoneyGlyph } from "@phosphor-icons/react/dist/ssr/Money";
import { PackageIcon as PackageGlyph } from "@phosphor-icons/react/dist/ssr/Package";
import { PauseIcon as PauseGlyph } from "@phosphor-icons/react/dist/ssr/Pause";
import { PhoneIcon as PhoneGlyph } from "@phosphor-icons/react/dist/ssr/Phone";
import { PlayIcon as PlayGlyph } from "@phosphor-icons/react/dist/ssr/Play";
import { ShareNetworkIcon as ShareNetworkGlyph } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { ShoppingCartSimpleIcon as ShoppingCartSimpleGlyph } from "@phosphor-icons/react/dist/ssr/ShoppingCartSimple";
import { TruckIcon as TruckGlyph } from "@phosphor-icons/react/dist/ssr/Truck";
import { WalletIcon as WalletGlyph } from "@phosphor-icons/react/dist/ssr/Wallet";
import { WhatsappLogoIcon as WhatsappLogoGlyph } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { XIcon as XGlyph } from "@phosphor-icons/react/dist/ssr/X";

/**
 * The storefront's icons, drawn with Phosphor — the family the dashboard uses.
 *
 * The names and props are the ones the storefront has always imported from
 * here, so no caller changes: `size` in pixels (20 unless said), `className`,
 * and any other svg attribute. Every icon is decorative by default
 * (`aria-hidden`, not focusable); a caller that needs it read out passes its
 * own aria attributes.
 *
 * The glyphs come from Phosphor's server-safe build, one file each, so this
 * module works in server and client components alike and a page only carries
 * the icons it draws. Weight is "regular"; the WhatsApp mark is the filled one,
 * as the brand draws it, and so are the two small play / pause marks.
 *
 * Direction: nothing here flips by itself. `ArrowIcon` points toward the
 * inline-end of a left-to-right page and callers turn it with
 * `rtl:rotate-180`, exactly as before; `ChevronIcon` points down and callers
 * rotate it; the others (truck, return arrow, up arrow) are never mirrored.
 */

type Glyph = typeof CheckGlyph;
type Weight = ComponentProps<Glyph>["weight"];
type IconProps = SVGProps<SVGSVGElement> & { size?: number; weight?: Weight };

/**
 * One storefront icon from one Phosphor glyph. The old set was stroked, so a
 * caller may still pass stroke attributes; Phosphor's shapes are filled, and
 * those attributes (and a `fill` meant for the old outline) are dropped here
 * rather than painted onto the new shape.
 */
function draw(Glyph: Glyph, defaultWeight: Weight = "regular") {
  return function StoreIcon({
    size = 20,
    weight = defaultWeight,
    stroke: _stroke,
    strokeWidth: _strokeWidth,
    strokeLinecap: _strokeLinecap,
    strokeLinejoin: _strokeLinejoin,
    fill: _fill,
    ...rest
  }: IconProps) {
    return <Glyph size={size} weight={weight} aria-hidden="true" focusable="false" {...rest} />;
  };
}

export const CashIcon = draw(MoneyGlyph);

export const CardIcon = draw(CreditCardGlyph);

export const WalletIcon = draw(WalletGlyph);

export const TruckIcon = draw(TruckGlyph);

export const ReturnIcon = draw(ArrowUUpLeftGlyph);

export const PhoneIcon = draw(PhoneGlyph);

export const CheckIcon = draw(CheckGlyph);

/** The "no" half of a check/cross pair, and the close control of the lightbox. */
export const CrossIcon = draw(XGlyph);

/** Points down; callers rotate it for the other directions. */
export const ChevronIcon = draw(CaretDownGlyph);

/** Points toward the inline-end; flip with `rtl:rotate-180`. */
export const ArrowIcon = draw(ArrowRightGlyph);

/** Always points up — never flipped, in either direction. */
export const ArrowUpIcon = draw(ArrowUpGlyph);

/** Shown over the gallery's main image: the photo opens larger. */
export const ZoomIcon = draw(MagnifyingGlassPlusGlyph);

export const CartGlyph = draw(ShoppingCartSimpleGlyph);

export const BoxIcon = draw(PackageGlyph);

export const ShareIcon = draw(ShareNetworkGlyph);

export const CopyIcon = draw(CopyGlyph);

export const GiftIcon = draw(GiftGlyph);

export const SearchIcon = draw(MagnifyingGlassGlyph);

/** The mobile header's menu control; the sheet it opens closes with CrossIcon. */
export const MenuIcon = draw(ListGlyph);

/**
 * The gallery slideshow's autoplay toggle, showing when it is running. Solid, like
 * the play mark beside it: the two swap in one small button and must weigh the same.
 */
export const PauseIcon = draw(PauseGlyph, "fill");

/** The gallery slideshow's autoplay toggle, showing when it is stopped. Solid, as it always was. */
export const PlayIcon = draw(PlayGlyph, "fill");

export const WhatsAppIcon = draw(WhatsappLogoGlyph, "fill");
