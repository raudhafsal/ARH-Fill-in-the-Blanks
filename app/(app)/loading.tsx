import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="absolute inset-0 animate-pulse rounded-full border-2 border-primary/40" />
        <Image src="/brand/logo-mark.png" alt="Loading" width={56} height={56} className="relative h-14 w-14 animate-pulse rounded-full" priority />
      </div>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
