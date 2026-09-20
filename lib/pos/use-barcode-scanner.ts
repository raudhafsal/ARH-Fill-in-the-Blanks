"use client";

import { useEffect, useRef } from "react";

/**
 * Captures USB/Bluetooth "keyboard wedge" barcode scanners: they type digits
 * very fast (well under human typing speed) and finish with Enter. This
 * listens globally, buffers fast keystrokes, and fires `onScan` with the
 * accumulated code when Enter arrives — without needing a focused input.
 * Typing normally (in the search box, a note field, etc) never triggers it
 * because the gap between keystrokes is far larger than the threshold.
 */
export function useBarcodeScanner(onScan: (code: string) => void, opts?: { enabled?: boolean; maxGapMs?: number; minLength?: number }) {
  const enabled = opts?.enabled ?? true;
  const maxGapMs = opts?.maxGapMs ?? 40;
  const minLength = opts?.minLength ?? 3;
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function handleKeydown(e: KeyboardEvent) {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (code.length >= minLength) {
          onScanRef.current(code);
        }
        return;
      }

      if (e.key.length === 1) {
        // A gap larger than a real scanner burst means this is human typing — reset the buffer.
        if (gap > maxGapMs) {
          bufferRef.current = "";
        }
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [enabled, maxGapMs, minLength]);
}
