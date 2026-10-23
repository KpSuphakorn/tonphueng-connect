import Link from "next/link";
import { Icon, type IconName } from "./icons";

const items: Array<{ id: "home" | "trip" | "order"; href: string; label: string; icon: IconName }> = [
  { id: "home", href: "/", label: "หน้าหลัก", icon: "home" },
  { id: "trip", href: "/my-trip", label: "My Trip", icon: "trip" },
  { id: "order", href: "/my-order", label: "My Order", icon: "bag" },
];

/** Customer bottom navigation (Main Page / My Trip / My Order); `current` marks the page that matches a tab. */
export function BottomNav({ current }: { current?: "home" | "trip" | "order" }) {
  return (
    <nav className="bottom-nav" aria-label="เมนูลูกค้า">
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={current === item.id ? "page" : undefined}>
          <Icon name={item.icon} size={24} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
