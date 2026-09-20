"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine, Camera } from "lucide-react";
import { toast } from "sonner";

/**
 * Visible barcode entry field. Manual typing + Enter works, and this is also
 * where a USB/Bluetooth scanner's Enter keypress naturally lands when this
 * field has focus — the global keyboard-wedge listener in the POS page
 * catches scans even when focus is elsewhere (e.g. mid search).
 *
 * Camera scanning uses the browser's built-in BarcodeDetector API when
 * present (Chrome/Edge on Android and some desktop builds) — no extra
 * dependency. It's feature-detected and the button simply doesn't render
 * when unsupported.
 */
export function BarcodeInput({ onScan }: { onScan: (code: string) => void }) {
  const [value, setValue] = useState("");
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setCameraSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      onScan(value.trim());
      setValue("");
    }
  }

  async function startCameraScan() {
    if (!cameraSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.length) {
            onScan(codes[0].rawValue);
            stopCameraScan();
            return;
          }
        } catch {
          // keep trying — a frame can occasionally fail to decode
        }
        if (streamRef.current) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      toast.error("Couldn't access the camera for barcode scanning.");
    }
  }

  function stopCameraScan() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stopCameraScan(), []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan or type barcode, then Enter"
            className="pl-9"
          />
        </div>
        {cameraSupported && (
          <Button type="button" variant="outline" size="icon" onClick={scanning ? stopCameraScan : startCameraScan}>
            <Camera className="h-4 w-4" />
          </Button>
        )}
      </div>
      {scanning && (
        <div className="overflow-hidden rounded-md border">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} autoPlay playsInline muted className="w-full" />
        </div>
      )}
    </div>
  );
}
