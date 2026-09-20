export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            ARH
          </div>
          <h1 className="text-xl font-semibold">ARH Fill in the Blank</h1>
          <p className="text-sm text-muted-foreground">Point of Sale</p>
        </div>
        {children}
      </div>
    </div>
  );
}
