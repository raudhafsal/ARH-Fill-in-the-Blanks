"use client";

import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";

/**
 * Catches any otherwise-uncaught error in the app and shows something friendlier
 * than Next.js's default "Application error: a server-side exception has occurred"
 * page. "Try again" re-renders the failed segment; if that keeps failing (e.g. a
 * real outage), the user can head back to the dashboard instead.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred while loading this page. Try again, and if it keeps happening, contact support.
      </p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">Error ref: {error.digest}</p>}
      <div className="mt-2 flex gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
        <a
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
        >
          <Home className="h-4 w-4" /> Go to dashboard
        </a>
      </div>
    </div>
  );
}
