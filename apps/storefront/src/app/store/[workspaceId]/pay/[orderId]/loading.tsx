import { PaySkeleton } from "@/components/payment/PaySkeleton";

/**
 * The pay page while its route is on its way: its title and one payment
 * state's outline (components/payment/PaySkeleton, which the page also shows
 * while the order's payment is being read).
 */
export default function PayLoading() {
  return <PaySkeleton />;
}
