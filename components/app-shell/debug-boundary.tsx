"use client";

import * as React from "react";

/**
 * TEMPORARY DIAGNOSTIC: a real React error boundary (class component), so it catches
 * errors thrown while rendering its children even during server-side rendering — unlike
 * Next.js's own error.tsx, which only ever receives a redacted generic message in
 * production. This prints the *real* error message and stack directly on the page so we
 * can see exactly what's failing. Safe to remove once found.
 */
export class DebugBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as any;
      return (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 16,
            margin: 8,
            fontSize: 12,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "2px solid #b91c1c",
          }}
        >
          {`DIAGNOSTIC — "${this.props.label}" threw:\n\n`}
          {"name: " + (err?.name ?? typeof err) + "\n"}
          {"message: " + (err?.message ?? String(err)) + "\n"}
          {"stack:\n" + (err?.stack ?? "n/a")}
        </pre>
      );
    }
    return this.props.children;
  }
}
