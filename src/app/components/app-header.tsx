import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

type Props = {
  /** Replaces the brand with a back link when the page sits under another screen. */
  back?: { href: string; label: string };
  brandHref?: string;
  /** Short workspace label shown beside the brand, e.g. ผู้ประกอบการ. */
  area?: string;
  children?: ReactNode;
};

export function Brand({ href = "/", area, label }: { href?: string; area?: string; label?: string }) {
  return (
    <Link href={href} className="brand" aria-label={label}>
      <img className="brand-logo" src="/images/logo.jpeg" width={40} height={40} alt="" />
      <span className="brand-name">ผึ้งพาเดิน{area && <small>{area}</small>}</span>
    </Link>
  );
}

export function AppHeader({ back, brandHref, area, children }: Props) {
  return (
    <header className="topbar">
      {back ? (
        <Link href={back.href} className="header-back"><Icon name="chevronLeft" /><span>{back.label}</span></Link>
      ) : <Brand href={brandHref} area={area} />}
      {children && <div className="topbar-actions">{children}</div>}
    </header>
  );
}
