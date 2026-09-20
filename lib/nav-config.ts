import type { UserRole } from "@/types/database";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Tags,
  Boxes,
  Truck,
  Wallet,
  Users,
  BarChart3,
  UserCog,
  Settings,
  ChefHat,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  mobilePriority?: boolean; // shown directly in bottom nav vs under "More"
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["administrator", "manager", "cashier"], mobilePriority: true },
  { label: "POS", href: "/pos", icon: ShoppingCart, roles: ["administrator", "manager", "cashier"], mobilePriority: true },
  { label: "Orders", href: "/orders", icon: Receipt, roles: ["administrator", "manager", "cashier"], mobilePriority: true },
  { label: "Products", href: "/products", icon: Package, roles: ["administrator", "manager"], mobilePriority: true },
  { label: "Categories", href: "/categories", icon: Tags, roles: ["administrator", "manager"] },
  { label: "Inventory", href: "/inventory", icon: Boxes, roles: ["administrator", "manager"] },
  { label: "Purchases", href: "/purchases", icon: Truck, roles: ["administrator", "manager"] },
  { label: "Expenses", href: "/expenses", icon: Wallet, roles: ["administrator", "manager"] },
  { label: "Customers", href: "/customers", icon: Users, roles: ["administrator", "manager", "cashier"] },
  { label: "Kitchen", href: "/kitchen", icon: ChefHat, roles: ["administrator", "manager", "cashier"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["administrator", "manager"] },
  { label: "Staff", href: "/staff", icon: UserCog, roles: ["administrator", "manager"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["administrator", "manager"] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
