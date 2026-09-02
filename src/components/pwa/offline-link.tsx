"use client";

import Link from "next/link";

/**
 * Next.js charge normalement une réponse RSC lors d’un clic. Hors ligne, on
 * force une vraie navigation afin que le service worker serve la page et ses
 * chunks précachés, y compris si cette route n’a jamais été ouverte auparavant.
 */
export function OfflineLink({ onClick, href, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !navigator.onLine && typeof href === "string") {
          event.preventDefault();
          window.location.assign(href);
        }
      }}
    />
  );
}
