import Link from "next/link";
import { db, schema } from "@/lib/db";
import { brandFontVariables } from "../fonts";
import { MobileNavMenu } from "./MobileNavMenu";
import { dashboardLinks } from "./navigation";
import { DashboardIcon } from "./DashboardIcon";
import s from "./dashboard.module.css";

export async function FamilyWorkspace({ children, section = "Overview" }: { children: React.ReactNode; section?: string }) {
  const [approver] = await db.select().from(schema.approver).limit(1);
  const firstName = approver?.fullName?.split(" ")[0] ?? "Your";
  const initials = approver?.fullName?.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "FA";
  const icons = ["overview", "check", "activity", "shield", "prescription"] as const;

  return <div className={`${brandFontVariables} ${s.shell}`}>
    <a className={s.skipLink} href="#dashboard-content">Skip to dashboard</a>
    <aside className={s.sidebar} aria-label="Family workspace">
      <Link href="/" className={s.wordmark}><span>g</span>guardian.</Link>
      <p className={s.workspaceLabel}>Family workspace</p>
      <nav className={s.sideLinks} aria-label="Dashboard sections">{dashboardLinks.map(([label, href], i) => <a key={href} href={href}><DashboardIcon name={icons[i]} /><span>{label}</span><span className={s.navArrow} aria-hidden="true">↗</span></a>)}</nav>
      <div className={s.sidebarNote}><DashboardIcon name="phone" /><h2>A familiar way to ask.</h2><p>Their regular phone call.<br />Your family view, right here.</p><Link href="/">The Guardian approach ↗</Link></div>
      <div className={s.sidebarProfile}><span className={s.avatar}>{initials}</span><div><strong>{firstName === "Your" ? "Your family" : `${firstName}’s family`}</strong><small>{approver?.role === "viewer" ? "Family viewer" : "Family caregiver"}</small></div></div>
    </aside>
    <div className={s.workspace}>
      <header className={s.topNav}><Link href="/" className={s.mobileBrand}>guardian.</Link><span className={s.topNavTitle}>Your family <span>/</span> {section}</span><div className={s.topNavRight}><span className={s.sandboxLabel}>Sandbox payments</span><Link href="/" className={s.homeLink}>Back to home ↗</Link><MobileNavMenu /></div></header>
      <main id="dashboard-content" className={s.main}>{children}</main>
    </div>
  </div>;
}
