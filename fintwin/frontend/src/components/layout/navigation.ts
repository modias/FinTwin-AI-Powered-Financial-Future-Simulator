import {
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  Receipt,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short description used by the mobile drawer. */
  description: string;
}

export const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
    description: "Safe-to-spend, forecast and recent activity",
  },
  {
    label: "Future Simulator",
    href: "/simulator",
    icon: TrendingUp,
    description: "Test a purchase against simulated futures",
  },
  {
    label: "Scenario Lab",
    href: "/scenarios",
    icon: FlaskConical,
    description: "Compare up to three decisions side by side",
  },
  {
    label: "Financial Insights",
    href: "/insights",
    icon: Lightbulb,
    description: "Simulated risk and spending analytics",
  },
  {
    label: "Transaction History",
    href: "/transactions",
    icon: Receipt,
    description: "Search and filter every transaction",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Protected minimum, safety target and horizon",
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname.startsWith(item.href));
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname.startsWith(item.href);
}
