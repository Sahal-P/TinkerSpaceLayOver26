"use client";

import Image, { type ImageLoader } from "next/image";

import { photos, type PhotoEntry, type PhotoName } from "@/config/photos";
import { cn } from "@/lib/utils";

// The Pexels CDN resizes on the fly, so Next.js doesn't need to proxy the images.
const pexelsLoader: ImageLoader = ({ src, width }) => `${src}?auto=compress&cs=tinysrgb&w=${width}`;

type PhotoProps = {
  name: PhotoName;
  /** Rendered width per breakpoint, so the browser picks the smallest file that is sharp. */
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** A credited editorial photo that fills its positioned parent. */
export function Photo({ name, sizes, priority = false, className }: PhotoProps) {
  const { id, alt, position }: PhotoEntry = photos[name];
  return (
    <Image
      loader={pexelsLoader}
      src={`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}
