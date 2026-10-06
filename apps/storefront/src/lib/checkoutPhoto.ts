/**
 * The purchase form's photo fields (dashboard → Checkout form → "Photo
 * upload"): the answer is the id of a photo this visitor uploaded
 * (components/checkout/CheckoutPhotoField). While a photo is still on its way
 * the field has no answer yet, so the form must wait rather than send the
 * order without it — this keeps which fields are uploading, by field key.
 */
const uploading = new Map<string, number>();

export function setPhotoUploading(fieldKey: string, on: boolean): void {
  const count = (uploading.get(fieldKey) ?? 0) + (on ? 1 : -1);
  if (count > 0) uploading.set(fieldKey, count);
  else uploading.delete(fieldKey);
}

export function isPhotoUploading(fieldKey: string): boolean {
  return uploading.has(fieldKey);
}

/** The server's word on a photo answer it could not take (another visitor's, unknown, or past its 48 hours). */
export function isExpiredPhotoProblem(message: string): boolean {
  return !/required/i.test(message) && /photo|upload|expired|missing|صور/i.test(message);
}
