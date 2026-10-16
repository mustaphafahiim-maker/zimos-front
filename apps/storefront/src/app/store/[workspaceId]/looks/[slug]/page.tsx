import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, storeGetShoppableImage, type PublicShoppableImage } from "@store-builder/api-client";
import { ShoppableImageView } from "@/components/ShoppableImageView";
import { container } from "@/components/ui";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";

type Params = Promise<{ workspaceId: string; slug: string }>;

async function load(workspaceId: string, slug: string): Promise<PublicShoppableImage | null> {
  try {
    return await storeGetShoppableImage(await createServerStorefrontApiClient(), workspaceId, slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, slug } = await params;
  const image = await load(workspaceId, slug);
  if (!image) return {};
  return { title: image.title, openGraph: { title: image.title, images: [image.imageUrl] } };
}

/** The shareable page of one shoppable image (SPEC §7.9). */
export default async function LookPage({ params }: { params: Params }) {
  const { workspaceId, slug } = await params;
  const image = await load(workspaceId, slug);
  if (!image) notFound();
  return (
    <div className={`${container} max-w-3xl py-8`}>
      <ShoppableImageView image={image} heading="h1" />
    </div>
  );
}
