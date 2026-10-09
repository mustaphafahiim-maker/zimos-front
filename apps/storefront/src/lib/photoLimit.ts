import { SHOPPER_PHOTO_MAX_BYTES, SHOPPER_PHOTO_MAX_MB } from "@store-builder/api-client";

/**
 * The size a shopper's photo may have (handoff 400): product-field photos,
 * transfer receipts and payment proofs are refused by the server above 5 MB
 * (413 FILE_TOO_LARGE, details { kind: "photo", maxBytes, maxMb }), so the
 * browser refuses a bigger file before sending it, with the same sentence.
 */
export const PHOTO_MAX_BYTES = SHOPPER_PHOTO_MAX_BYTES;

export const PHOTO_LIMIT_TEXT = {
  en: { hint: `Up to ${SHOPPER_PHOTO_MAX_MB} MB`, tooLarge: `The photo is larger than ${SHOPPER_PHOTO_MAX_MB} MB` },
  ar: { hint: "حتى 5 ميجابايت", tooLarge: "الصورة أكبر من 5 ميجابايت." },
  fr: { hint: `Jusqu'à ${SHOPPER_PHOTO_MAX_MB} Mo`, tooLarge: `La photo dépasse ${SHOPPER_PHOTO_MAX_MB} Mo.` },
};

/** True when the file is over the limit and must not be sent. */
export function photoTooLarge(file: { size: number }): boolean {
  return file.size > PHOTO_MAX_BYTES;
}
