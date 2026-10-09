/**
 * Upload size limits (backend: frontend-handoff item 400). Check these in the browser before
 * sending; the server answers 413 FILE_TOO_LARGE with details { kind, maxBytes, maxMb }
 * (kind image | video | model | file | photo) and 422 IMAGE_DIMENSIONS_TOO_LARGE
 * (details { maxMegapixels: 60 }).
 */
const MB = 1024 * 1024;

/** Media library images (JPEG, PNG, WebP, GIF): product pictures, builder images, logos, favicons. */
export const MEDIA_IMAGE_MAX_BYTES = 10 * MB;
export const MEDIA_VIDEO_MAX_BYTES = 30 * MB;
export const MEDIA_MODEL_MAX_BYTES = 15 * MB;
/** Shoppers' uploads: product-field photos, transfer receipts and manual-payment proofs. */
export const SHOPPER_PHOTO_MAX_BYTES = 5 * MB;

export const MEDIA_IMAGE_MAX_MB = MEDIA_IMAGE_MAX_BYTES / MB;
export const SHOPPER_PHOTO_MAX_MB = SHOPPER_PHOTO_MAX_BYTES / MB;
