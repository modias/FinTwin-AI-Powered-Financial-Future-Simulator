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
  /** True for pages that are previews of later-phase functionality. */
  isPreview?: boolean;
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
    description: "Monte Carlo simulation, coming in Phase 2",
    isPreview: true,
  },
  {
    label: "Scenario Lab",
    href: "/scenarios",
    icon: FlaskConical,
    description: "Compare financial decisions side by side",
    isPreview: true,
  },
  {
    label: "Financial Insights",
    href: "/insights",
    icon: Lightbulb,
    description: "Descriptive analytics from your transactions",
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
    description: "Protected balance, horizon and theme",
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname.startsWith(item.href));
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname.startsWith(item.href);
}
