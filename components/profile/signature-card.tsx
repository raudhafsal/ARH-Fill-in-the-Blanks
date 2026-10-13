"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eraser, Loader2, Upload } from "lucide-react";

const W = 600;
const H = 200;

/** Draw-or-upload e-signature. Stored as a small transparent PNG and stamped on exported report PDFs. */
export function SignatureCard({ userId, initialSignature }: { userId: string; initialSignature: string | null }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [saved, setSaved] = useState<string | null>(initialSignature);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W;
    c.height = H;
  }, []);

  function ctx() {
    const c = canvasRef.current!;
    const g = c.getContext("2d")!;
    g.lineWidth = 3;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#111111";
    return g;
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const g = ctx();
    const p = point(e);
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x + 0.01, p.y + 0.01);
    g.stroke();
    setDirty(true);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const g = ctx();
    const p = point(e);
    g.lineTo(p.x, p.y);
    g.stroke();
  }
  function up() {
    drawing.current = false;
  }

  function clearCanvas() {
    canvasRef.current!.getContext("2d")!.clearRect(0, 0, W, H);
    setDirty(false);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG or JPG).");
      return;
    }
    const img = new Image();
    img.onload = () => {
      const g = canvasRef.current!.getContext("2d")!;
      g.clearRect(0, 0, W, H);
      const scale = Math.min(W / img.width, H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      setDirty(true);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  async function save() {
    const c = canvasRef.current!;
    const blank = !c.getContext("2d")!.getImageData(0, 0, W, H).data.some((v, i) => i % 4 === 3 && v > 0);
    if (blank) {
      toast.error("Draw or upload your signature first.");
      return;
    }
    setSaving(true);
    const data = c.toDataURL("image/png");
    const { error } = await createClient().from("user_signatures").upsert({ user_id: userId, image_data: data, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error("Unable to save signature.");
      return;
    }
    setSaved(data);
    setDirty(false);
    clearCanvas();
    toast.success("Signature saved.");
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    const { error } = await createClient().from("user_signatures").delete().eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error("Unable to remove signature.");
      return;
    }
    setSaved(null);
    toast.success("Signature removed.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-signature</CardTitle>
        <CardDescription>Printed under &quot;Prepared by&quot; when you export a report to PDF. Only you can see it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Current signature</p>
            <div className="inline-block rounded-md border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={saved} alt="Your signature" className="h-16 w-auto" />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{saved ? "Replace it — draw below or upload an image" : "Draw below or upload an image"}</p>
          <canvas
            ref={canvasRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className="w-full touch-none rounded-md border bg-white"
            style={{ aspectRatio: `${W} / ${H}`, cursor: "crosshair" }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save signature
          </Button>
          <Button type="button" variant="outline" onClick={clearCanvas} disabled={saving}>
            <Eraser className="h-4 w-4" /> Clear
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={saving}>
            <Upload className="h-4 w-4" /> Upload image
          </Button>
          {saved && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={saving}>
              Remove saved signature
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </div>
      </CardContent>
    </Card>
  );
}
