import Link from "next/link";

import { db, schema } from "@/lib/db";

import { brandFontVariables } from "../fonts";
import { MobileNavMenu } from "./MobileNavMenu";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [approver] = await db.select().from(schema.approver).limit(1);
  const firstName = approver?.fullName?.split(" ")[0] ?? "Family";
  const initials = approver?.fullName
    ? approver.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "FA";

  return (
    <div className={`${brandFontVariables} ${styles.shell}`}>
      <header className={styles.topNav}>
        <div className={styles.topNavWordmark}>guardian.</div>

        <nav className={styles.topNavLinks} aria-label="Dashboard">
          <span className={`${styles.topNavLink} ${styles.topNavLinkActive}`}>Family overview</span>
          <span className={styles.topNavLink}>Activity history</span>
          <Link href="/" className={styles.topNavLink}>
            Back to home ↗
          </Link>
        </nav>

        <div className={styles.topNavProfile}>
          <span className={styles.topNavProfileName}>{firstName}&rsquo;s family</span>
          <span className={styles.topNavAvatar}>{initials}</span>
        </div>

        <MobileNavMenu />
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
