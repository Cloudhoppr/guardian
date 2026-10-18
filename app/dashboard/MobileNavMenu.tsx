"use client";

import Link from "next/link";
import { useState } from "react";
import s from "./dashboard.module.css";

import { dashboardLinks } from "./navigation";

export function MobileNavMenu() {
  const [open, setOpen] = useState(false);
  return <div className={s.mobileMenuWrap}>
    <button type="button" className={s.mobileMenuButton} aria-expanded={open} aria-controls="dashboard-mobile-menu" onClick={() => setOpen(!open)}>Explore <span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <nav id="dashboard-mobile-menu" className={s.mobileMenuPanel} aria-label="Dashboard sections">{dashboardLinks.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}<Link href="/">Back to homepage ↗</Link></nav>}
  </div>;
}
