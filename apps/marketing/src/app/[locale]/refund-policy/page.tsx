import { PolicyPage, policyMetadata } from "@/components/policy-page";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params) {
  return policyMetadata("refund-policy", (await params).locale);
}

export default function Page({ params }: Params) {
  return <PolicyPage slug="refund-policy" params={params} />;
}
