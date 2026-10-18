"use client";

import Link from "next/link";
import { useState } from "react";

import styles from "./dashboard.module.css";

export function MobileNavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.mobileMenuWrap}>
      <button
        type="button"
        className={styles.mobileMenuButton}
        aria-expanded={open}
        aria-controls="dashboard-mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        Family menu <span aria-hidden="true">{open ? "↑" : "↓"}</span>
      </button>
      {open ? (
        <nav id="dashboard-mobile-menu" className={styles.mobileMenuPanel} aria-label="Dashboard">
          <span className={`${styles.topNavLink} ${styles.topNavLinkActive}`}>Family overview</span>
          <span className={styles.topNavLink}>Activity history</span>
          <Link href="/" className={styles.topNavLink}>
            Back to home ↗
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
