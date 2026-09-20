import { createClient } from "@supabase/supabase-js";

const url = "https://fercnahcnikdnvbusnuv.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmNuYWhjbmlrZG52YnVzbnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTUyNjQsImV4cCI6MjEwNTQ5MTI2NH0.gn2T61FJFDRkRrOtibkP8yDz3EF30iLC6P0ZEQAIx3s";

const supabase = createClient(url, anon);

const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: "looth@arh.mv",
  password: "Zla@9821552",
});

if (signInError) {
  console.error("SIGN IN ERROR:", signInError);
  process.exit(1);
}
console.log("Signed in as", signInData.user.id, signInData.user.email);

async function run(label, fn) {
  try {
    const result = await fn();
    if (result.error) {
      console.log(`[${label}] SUPABASE ERROR:`, JSON.stringify(result.error, null, 2));
    } else {
      console.log(`[${label}] OK, rows:`, Array.isArray(result.data) ? result.data.length : result.data);
    }
  } catch (e) {
    console.log(`[${label}] THREW:`, e.message, e.stack);
  }
}

const now = new Date();
const todayStart = new Date(now); todayStart.setUTCHours(0,0,0,0);
const todayEnd = new Date(todayStart.getTime() + 24*60*60*1000 - 1);
const weekStart = new Date(todayStart.getTime() - 6*24*60*60*1000);
const monthStart = new Date(todayStart.getTime() - 29*24*60*60*1000);

await run("profiles (requireProfile)", () => supabase.from("profiles").select("*").eq("id", signInData.user.id).single());

await run("orders today", () => supabase.from("orders").select("id,total,discount_amount,created_at,voided").gte("created_at", todayStart.toISOString()).lte("created_at", todayEnd.toISOString()).eq("voided", false));

await run("orders week", () => supabase.from("orders").select("id,total,created_at,voided").gte("created_at", weekStart.toISOString()).eq("voided", false));

await run("orders month", () => supabase.from("orders").select("id,total,created_at,voided").gte("created_at", monthStart.toISOString()).eq("voided", false));

await run("expenses today", () => supabase.from("expenses").select("amount").gte("expense_date", todayStart.toISOString().slice(0,10)).lte("expense_date", todayEnd.toISOString().slice(0,10)));

await run("products count", () => supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true));

await run("customers count", () => supabase.from("customers").select("id", { count: "exact", head: true }));

await run("low stock products", () => supabase.from("products").select("id,name,current_stock,minimum_stock").eq("active", true).eq("track_inventory", true));

await run("recent orders + cashier join", () => supabase
  .from("orders")
  .select("id,order_number,created_at,total,status,voided,cashier:profiles!orders_cashier_id_fkey(full_name)")
  .order("created_at", { ascending: false })
  .limit(8));

await run("recent order_items + product/category join", () => supabase
  .from("order_items")
  .select("line_total,created_at,product:products(category_id,category:categories(name))")
  .gte("created_at", weekStart.toISOString()));

await run("recent payments + method join", () => supabase
  .from("payments")
  .select("amount,created_at,payment_method:payment_methods(name)")
  .gte("created_at", weekStart.toISOString()));

await run("payment methods", () => supabase.from("payment_methods").select("id,name").eq("enabled", true));

console.log("DONE");
process.exit(0);
