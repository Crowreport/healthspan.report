"use client";

import { useRouter } from "next/navigation";

export default function BackLink({
  fallbackHref,
  children,
  className,
}: {
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <a
      href={fallbackHref}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        // If user navigated here from within the app, this returns them
        // to the exact previous page (pagination, scroll position, etc).
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      {children}
    </a>
  );
}

