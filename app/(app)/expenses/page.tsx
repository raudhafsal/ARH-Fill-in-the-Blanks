import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/types/database";
import { ExpensesClient } from "./expenses-client";
import { thisMonthRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const { from, to } = thisMonthRange();

  const [{ data: expenses }, { data: categories }, { data: paymentMethods }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false }),
    supabase.from("expense_categories").select("*").order("name", { ascending: true }),
    supabase.from("payment_methods").select("*").order("display_order", { ascending: true }),
  ]);

  return (
    <ExpensesClient
      initialExpenses={(expenses ?? []) as Expense[]}
      categories={(categories ?? []) as ExpenseCategory[]}
      paymentMethods={(paymentMethods ?? []) as PaymentMethod[]}
      initialFrom={from}
      initialTo={to}
    />
  );
}
