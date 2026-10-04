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
  Landmark,
  ClipboardList,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  mobilePriority?: boolean; // shown directly in bottom nav vs under "More"
  /** A group renders as an expandable menu in the sidebar; its own href is unused. */
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["administrator", "manager", "cashier"], mobilePriority: true },
  {
    label: "Manage Register",
    href: "#manage-register",
    icon: Landmark,
    roles: ["administrator", "manager", "cashier"],
    children: [
      { label: "Register", href: "/register", icon: Landmark, roles: ["administrator", "manager", "cashier"] },
      { label: "Register sessions", href: "/register-sessions", icon: ClipboardList, roles: ["administrator", "manager"] },
    ],
  },
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
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => c.roles.includes(role)) } : item))
    .filter((item) => !item.children || item.children.length > 0);
}

/** Groups flattened into their children — used by the mobile bottom nav, which has no submenus. */
export function flattenNav(items: NavItem[]): NavItem[] {
  return items.flatMap((i) => (i.children ? i.children : [i]));
}
