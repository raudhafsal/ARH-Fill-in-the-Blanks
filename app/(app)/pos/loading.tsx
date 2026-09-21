export default function PosLoading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="absolute inset-0 animate-pulse rounded-full border-2 border-primary/40" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="Loading" className="relative h-14 w-14 animate-pulse rounded-full object-contain" />
      </div>
      <p className="text-sm text-muted-foreground">Loading menu…</p>
    </div>
  );
}
