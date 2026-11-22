"use client";

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

/** Opens the print dialog with a file-friendly title, so "Save as PDF" proposes a sensible name. */
export function ExportPdfButton({ fileName, label = "Export PDF" }: { fileName: string; label?: string }) {
  function handleClick() {
    const previous = document.title;
    document.title = fileName;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  return (
    <Button className="no-print gap-1.5" onClick={handleClick}>
      <FileDown className="h-4 w-4" />
      {label}
    </Button>
  );
}
