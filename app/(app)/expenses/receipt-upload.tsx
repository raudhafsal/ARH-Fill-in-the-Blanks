"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Uploader for the private `expense-receipts` bucket. Since the bucket is not
 * public, `value` stores the storage object *path* (not a URL) and we fetch a
 * short-lived signed URL on demand when the receipt needs to be viewed.
 */
export function ReceiptUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Receipt must be smaller than 10MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("expense-receipts").upload(path, file, { upsert: false });
      if (error) throw error;
      onChange(path);
      toast.success("Receipt uploaded.");
    } catch {
      toast.error("Unable to upload receipt. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleView() {
    if (!value) return;
    setViewing(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(value, 3600);
      if (error || !data?.signedUrl) throw error ?? new Error("no url");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Unable to open receipt.");
    } finally {
      setViewing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {value ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={handleView} disabled={viewing}>
            {viewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            View receipt
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          Attach receipt
        </Button>
      )}
    </div>
  );
}
