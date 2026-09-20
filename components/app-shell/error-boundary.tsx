"use client";

import React from "react";

/**
 * A real React error boundary. Unlike a try/catch inside a function component,
 * this DOES catch errors thrown while rendering this boundary's children (e.g.
 * a child component's own render throwing) both during SSR and on the client —
 * which a try/catch around only the parent's own function body cannot do.
 */
export class ShellErrorBoundary extends React.Component<
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Also surface it in server/client logs in case the visual fallback
    // itself somehow fails to reach the screen.
    console.error(`[ShellErrorBoundary:${this.props.label}]`, error, info?.componentStack);
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
            maxWidth: 500,
          }}
        >
          {`BOUNDARY [${this.props.label}] caught:\n\n`}
          {"name: " + (err?.name ?? typeof err) + "\n"}
          {"message: " + (err?.message ?? String(err)) + "\n"}
          {"stack:\n" + (err?.stack ?? "n/a")}
        </pre>
      );
    }
    return this.props.children;
  }
}
