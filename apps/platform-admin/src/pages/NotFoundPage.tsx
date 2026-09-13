import { Link } from "react-router-dom";
import { buttonVariants } from "@store-builder/ui";
import { EmptyBlock } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Page not found" />
      <EmptyBlock
        message="There's nothing at this address in the admin console."
        action={
          <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Go to overview
          </Link>
        }
      />
    </div>
  );
}
