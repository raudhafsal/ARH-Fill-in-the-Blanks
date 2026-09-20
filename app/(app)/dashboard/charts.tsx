"use client";

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
  Legend,
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

export function CategoryPieChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Sales by category</CardTitle></CardHeader>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">No sales yet</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales by category</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatMVR(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PaymentMethodChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Payment method breakdown</CardTitle></CardHeader>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">No payments yet</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment method breakdown</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatMVR(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
