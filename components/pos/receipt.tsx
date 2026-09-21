import { cn, formatMVR, formatMaldivesDateTime } from "@/lib/utils";
import type { ReceiptData } from "@/lib/pos/types";
import type { BusinessSettings } from "@/types/database";
import { Badge } from "@/components/ui/badge";

/**
 * Shared receipt layout used both in the post-sale dialog and the printable
 * /orders/[id]/receipt page. `width` picks the print CSS class — "58mm" /
 * "80mm" (defined in app/globals.css) for thermal printers, or "a4" (the
 * default) for a normal browser/A4 print. Print with window.print(); the
 * #receipt-print-area id and .no-print rules already exist in globals.css.
 * A "Download PDF" button isn't wired up — no PDF library is installed and
 * adding one is unnecessary weight when Print → Save as PDF already works.
 */
export function Receipt({
  data,
  business,
  width = "a4",
}: {
  data: ReceiptData;
  business: Pick<BusinessSettings, "business_name" | "logo_url" | "address" | "phone" | "receipt_footer">;
  width?: "58mm" | "80mm" | "a4";
}) {
  return (
    <div
      id="receipt-print-area"
      className={cn(
        "mx-auto bg-background p-4 text-foreground",
        width === "58mm" && "receipt-58mm",
        width === "80mm" && "receipt-80mm",
        width === "a4" && "max-w-md"
      )}
    >
      <div className="mb-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={business.logo_url || "/brand/logo-mark.png"}
          alt=""
          className={cn("mx-auto mb-1.5 object-contain", width === "a4" ? "h-14 w-14" : "h-10 w-10")}
        />
        <p className="text-base font-bold">{business.business_name}</p>
        {business.address && <p className="text-xs text-muted-foreground">{business.address}</p>}
        {business.phone && <p className="text-xs text-muted-foreground">{business.phone}</p>}
      </div>

      <div className="mb-2 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Order #</span>
          <span className="font-medium">{data.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date</span>
          <span>{formatMaldivesDateTime(data.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier</span>
          <span>{data.cashierName}</span>
        </div>
        <div className="flex justify-between">
          <span>Order type</span>
          <span className="capitalize">{data.orderType.replace("_", " ")}</span>
        </div>
        {data.syncStatus === "pending" && (
          <div className="flex justify-end">
            <Badge variant="warning" className="no-print">Pending Sync</Badge>
          </div>
        )}
      </div>

      <div className="my-2 border-t border-dashed" />

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left">
            <th className="pb-1 font-medium">Item</th>
            <th className="pb-1 text-right font-medium">Qty</th>
            <th className="pb-1 text-right font-medium">Price</th>
            <th className="pb-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-0.5 pr-1">{item.productName}</td>
              <td className="py-0.5 text-right">{item.quantity}</td>
              <td className="py-0.5 text-right">{formatMVR(item.unitPrice)}</td>
              <td className="py-0.5 text-right">{formatMVR(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed" />

      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMVR(data.subtotal)}</span>
        </div>
        {data.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatMVR(data.discountAmount)}</span>
          </div>
        )}
        {data.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>{data.taxName}</span>
            <span>{formatMVR(data.taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatMVR(data.total)}</span>
        </div>
      </div>

      <div className="my-2 border-t border-dashed" />

      <div className="space-y-0.5 text-xs">
        {data.payments.map((p, idx) => (
          <div key={idx}>
            <div className="flex justify-between">
              <span>{p.methodName}</span>
              <span>{formatMVR(p.amount)}</span>
            </div>
            {p.amountReceived !== null && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Received</span>
                  <span>{formatMVR(p.amountReceived)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Change</span>
                  <span>{formatMVR(p.changeAmount)}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {data.notes && (
        <>
          <div className="my-2 border-t border-dashed" />
          <p className="text-xs italic">Note: {data.notes}</p>
        </>
      )}

      <div className="mt-3 text-center text-xs text-muted-foreground">{business.receipt_footer}</div>
    </div>
  );
}
