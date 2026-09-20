"use client";

import { useEffect, useRef } from "react";

export interface PosKeyboardHandlers {
  onFocusSearch?: () => void;
  onOpenPayment?: () => void;
  onHoldOrder?: () => void;
  onOpenDiscount?: () => void;
  onEscape?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/** POS keyboard shortcuts: F2 search, F4 payment, F6 hold, F8 discount, Esc close, Ctrl/Cmd+K search. */
export function usePosKeyboardShortcuts(handlers: PosKeyboardHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const h = handlersRef.current;

      if (e.key === "Escape") {
        // Let a focused text input keep its own Escape behavior (e.g. clearing) when nothing else needs it.
        h.onEscape?.();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        h.onFocusSearch?.();
        return;
      }

      // Function keys are safe to hijack even while typing — they never insert text.
      switch (e.key) {
        case "F2":
          e.preventDefault();
          h.onFocusSearch?.();
          return;
        case "F4":
          e.preventDefault();
          h.onOpenPayment?.();
          return;
        case "F6":
          e.preventDefault();
          h.onHoldOrder?.();
          return;
        case "F8":
          e.preventDefault();
          h.onOpenDiscount?.();
          return;
        default:
          if (isTypingTarget(e.target)) return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
