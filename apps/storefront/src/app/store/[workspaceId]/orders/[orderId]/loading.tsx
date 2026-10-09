import { OrderConfirmationSkeleton } from "@/components/OrderConfirmation";

/**
 * What the tap on «تأكيد الطلب» shows while the thank-you route is on its way:
 * the first screen's outline, so the confirmation lands where the outline was
 * (components/OrderConfirmation draws both; keep them alike).
 */
export default function OrderConfirmationLoading() {
  return <OrderConfirmationSkeleton />;
}
