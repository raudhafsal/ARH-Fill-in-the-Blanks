import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Image src="/brand/logo-mark.png" alt="ARH Fill in the Blank" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl" priority />
          <h1 className="text-xl font-semibold">ARH Fill in the Blank</h1>
          <p className="text-sm text-muted-foreground">Point of Sale</p>
        </div>
        {children}
      </div>
    </div>
  );
}
