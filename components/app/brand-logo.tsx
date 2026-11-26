/* eslint-disable @next/next/no-img-element */

import { Logo } from "./logo";
import { cn } from "@/lib/utils";

// Chooses between the org's uploaded logo and the default CIRIS wordmark.
// Keeps the current CIRIS visual exactly as-is when no org logo is set
// (the common case on review.ciris.studio / chapter103).
export function BrandLogo({
  logoUrl,
  alt,
  className,
}: {
  logoUrl: string | null | undefined;
  alt: string;
  className?: string;
}) {
  if (logoUrl) {
    // External/uploaded logo. We size by height only so wordmarks of
    // different proportions all behave; width auto-adjusts.
    return (
      <img
        src={logoUrl}
        alt={alt}
        className={cn("h-9 w-auto object-contain", className)}
      />
    );
  }
  return <Logo className={className} />;
}
