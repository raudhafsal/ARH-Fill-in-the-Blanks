"use client";

/**
 * Fallback for errors thrown by the ROOT layout itself (app/layout.tsx) — the one case
 * app/error.tsx can't catch, since that boundary lives inside the root layout. This
 * replaces the entire document, so it needs its own <html>/<body>.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: 380, fontSize: "0.875rem", color: "#64748b" }}>
            An unexpected error occurred. Try again, and if it keeps happening, contact support.
          </p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#94a3b8" }}>Error ref: {error.digest}</p>}
          <button
            onClick={() => reset()}
            style={{
              height: 40,
              padding: "0 1rem",
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
