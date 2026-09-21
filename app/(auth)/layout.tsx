import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="ARH Fill in the Blank" className="h-[72px] w-[72px] rounded-2xl object-contain" />
          <h1 className="text-xl font-semibold">ARH Fill in the Blank</h1>
          <p className="text-sm text-muted-foreground">Point of Sale</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/download" className="hover:underline">
            Install the app on your phone
          </Link>
        </p>
      </div>
    </div>
  );
}
