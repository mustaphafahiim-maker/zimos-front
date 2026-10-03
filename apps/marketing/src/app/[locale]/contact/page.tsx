import { PolicyPage, policyMetadata } from "@/components/policy-page";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params) {
  return policyMetadata("contact", (await params).locale);
}

export default function Page({ params }: Params) {
  return <PolicyPage slug="contact" params={params} />;
}
