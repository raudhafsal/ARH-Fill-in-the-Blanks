"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMVR, formatMaldivesDate, round2 } from "@/lib/utils";
import type { BusinessSettings, Customer } from "@/types/database";
import { ArrowLeft, Printer, MessageCircle } from "lucide-react";

export interface StatementLine {
  date: string;
  ref: string;
  description: string;
  charge: number;
  credit: number;
  balance: number;
}

function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 7) return "960" + digits; // Maldives local number
  return digits.length >= 8 ? digits : null;
}

export function StatementClient({
  customer,
  business,
  lines,
  generatedAt,
}: {
  customer: Customer;
  business: BusinessSettings;
  lines: StatementLine[];
  generatedAt: string;
}) {
  const totalCharged = round2(lines.reduce((s, l) => s + l.charge, 0));
  const totalCredited = round2(lines.reduce((s, l) => s + l.credit, 0));
  const balance = round2(totalCharged - totalCredited);

  const wa = whatsappNumber(customer.phone);
  const message =
    `Hello ${customer.full_name}, this is ${business.business_name}. ` +
    (balance > 0
      ? `Your outstanding credit balance is ${formatMVR(balance)} as of ${formatMaldivesDate(generatedAt)}. Please arrange payment at your earliest convenience. Thank you!`
      : `Your credit account is fully settled as of ${formatMaldivesDate(generatedAt)}. Thank you!`);
  const waHref = `https://wa.me/${wa ?? ""}?text=${encodeURIComponent(message)}`;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> {wa ? "Send reminder on WhatsApp" : "WhatsApp (choose contact)"}
            </a>
          </Button>
          <Button className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div id="statement-print-area" className="mx-auto max-w-3xl rounded-xl border bg-white p-8 text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-xl font-bold">{business.business_name}</h1>
            {business.address && <p className="text-sm text-neutral-600">{business.address}</p>}
            <p className="text-sm text-neutral-600">{[business.phone, business.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide">Credit bill</p>
            <p className="text-sm text-neutral-600">Statement date: {formatMaldivesDate(generatedAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Billed to</p>
            <p className="text-base font-semibold">{customer.full_name}</p>
            {customer.phone && <p>{customer.phone}</p>}
            {customer.address && <p>{customer.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Amount due</p>
            <p className="text-3xl font-bold">{formatMVR(balance)}</p>
          </div>
        </div>

        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">No credit activity for this customer.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Reference</th>
                <th className="px-2 py-2">Details</th>
                <th className="px-2 py-2 text-right">Charged</th>
                <th className="px-2 py-2 text-right">Paid / refunded</th>
                <th className="px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="whitespace-nowrap px-2 py-2">{formatMaldivesDate(l.date)}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-medium">{l.ref}</td>
                  <td className="px-2 py-2 text-neutral-600">{l.description}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{l.charge ? formatMVR(l.charge) : ""}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{l.credit ? formatMVR(l.credit) : ""}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{formatMVR(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-5 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-neutral-600">Total charged on credit</span><span className="tabular-nums">{formatMVR(totalCharged)}</span></div>
          <div className="flex justify-between"><span className="text-neutral-600">Total paid / refunded</span><span className="tabular-nums">{formatMVR(totalCredited)}</span></div>
          <div className="flex justify-between border-t pt-1.5 text-base font-bold"><span>Balance due</span><span className="tabular-nums">{formatMVR(balance)}</span></div>
        </div>

        <p className="mt-8 border-t pt-4 text-center text-xs text-neutral-500">
          {business.receipt_footer || "Thank you for your business."}
        </p>
      </div>
    </div>
  );
}
