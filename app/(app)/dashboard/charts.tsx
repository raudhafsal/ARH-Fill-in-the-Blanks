"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMVR } from "@/lib/utils";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export function SalesByDayChart({ data }: { data: { day: string; sales: number; orders: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales &amp; orders by day (last 7 days)</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(value: number, name: string) => (name === "sales" ? formatMVR(value) : value)} />
            <Bar dataKey="sales" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function OrdersByDayChart({ data }: { data: { day: string; orders: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Orders by day (last 7 days)</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="orders" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function BreakdownPie({ title, empty, data, colorOffset = 0 }: { title: string; empty: string; data: { name: string; value: number }[]; colorOffset?: number }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const pct = (v: number) => (total ? Math.round((v / total) * 1000) / 10 : 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sorted} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={85} paddingAngle={2} stroke="none">
                  {sorted.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + colorOffset) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${formatMVR(value)} (${pct(value)}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-2 text-sm">
            {sorted.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[(i + colorOffset) % COLORS.length] }} />
                  <span className="font-medium">{d.name}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {formatMVR(d.value)} · {pct(d.value)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function CategoryPieChart({ data }: { data: { name: string; value: number }[] }) {
  return <BreakdownPie title="Sales by category" empty="No sales yet" data={data} />;
}

export function PaymentMethodChart({ data }: { data: { name: string; value: number }[] }) {
  return <BreakdownPie title="Payment method breakdown" empty="No payments yet" data={data} colorOffset={3} />;
}

export type BreakdownPeriod = "week" | "month" | "last_month" | "all";
export type BreakdownData = Record<BreakdownPeriod, { category: { name: string; value: number }[]; payment: { name: string; value: number }[] }>;

const PERIODS: { key: BreakdownPeriod; label: string }[] = [
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "all", label: "All time" },
];

export function BreakdownCharts({ data }: { data: BreakdownData }) {
  const [period, setPeriod] = useState<BreakdownPeriod>("week");
  const current = data[period];
  return (
    <div className="space-y-3 lg:col-span-2">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (period === p.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownPie
          title="Sales by category"
          empty={period === "last_month" || period === "all" ? "No item details for this period (imported Ewity bills have totals only)" : "No sales yet"}
          data={current.category}
        />
        <BreakdownPie title="Payment method breakdown" empty="No payments yet" data={current.payment} colorOffset={3} />
      </div>
    </div>
  );
}
