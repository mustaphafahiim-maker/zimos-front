/* eslint-disable @next/next/no-img-element -- the plain <img> is the fallback on purpose, see below. */
import Image from "next/image";
import type { ImgHTMLAttributes } from "react";
import { isOptimizableImage } from "@/lib/imageOrigins";

type StoreImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "srcSet" | "sizes"> & {
  src: string;
  alt: string;
  /** The intrinsic size the box is drawn at; with `className` sizing it, this reserves the space. */
  width: number;
  height: number;
  /** How wide the image shows at each breakpoint, for the browser to pick a file. */
  sizes: string;
};

/**
 * A merchant photo.
 *
 * Merchant media are arbitrary remote URLs, so Next's optimizer can only
 * serve the ones on an origin listed in NEXT_PUBLIC_STORE_IMAGE_ORIGINS (the
 * media bucket's public address, set at build time — lib/imageOrigins.ts). For
 * those, next/image sends a resized WebP picked by `sizes` instead of the
 * full upload. Everything else — and every image while the variable is unset —
 * is the same plain <img> the storefront always drew, with the same width,
 * height, loading and priority attributes.
 */
export function StoreImage({ src, alt, width, height, sizes, ...rest }: StoreImageProps) {
  if (isOptimizableImage(src)) {
    return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} {...rest} />;
  }
  return <img src={src} alt={alt} width={width} height={height} {...rest} />;
}
