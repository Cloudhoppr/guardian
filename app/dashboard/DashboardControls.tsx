"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DashboardIcon } from "./DashboardIcon";
import s from "./dashboard.module.css";

export function RefreshDashboard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className={s.refreshButton} disabled={pending} onClick={() => startTransition(() => router.refresh())} type="button"><DashboardIcon name="refresh" /><span role="status">{pending ? "Refreshing…" : "Refresh activity"}</span></button>;
}

export type ActivityEntry = { id: string; title: string; message: string; timestamp: string; dateTime: string; category: "requests" | "reviews" | "safety" };

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const visible = entries.filter(e => (filter === "all" || e.category === filter) && `${e.title} ${e.message}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className={s.feedControls}>
      <div className={s.filters} role="group" aria-label="Filter recent activity">{[["all", "All activity"], ["reviews", "Family reviews"], ["safety", "Safety"]].map(([value, label]) => <button type="button" key={value} className={filter === value ? s.filterActive : s.filterButton} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <label className={s.search}><span className="sr-only">Search recent activity</span><input type="search" placeholder="Search activity…" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>
    <p className={s.resultCount} role="status">{visible.length} of {entries.length} recent events</p>
    {visible.length ? <ol className={s.activityList}>{visible.map(e => <li key={e.id} className={s.activityRow}>
      <span className={`${s.activityIcon} ${e.category === "safety" ? s.activityAlert : ""}`}><DashboardIcon name={e.category === "safety" ? "shield" : e.category === "reviews" ? "check" : "phone"} size={17} /></span>
      <div className={s.activityBody}><div className={s.activityTitleRow}><h3>{e.title}</h3><time dateTime={e.dateTime}>{e.timestamp}</time></div><p>{e.message}</p></div>
    </li>)}</ol> : <div className={s.emptyState}><DashboardIcon name="activity" size={28} /><h3>{entries.length ? "No matching activity" : "The story starts with a request."}</h3><p>{entries.length ? "Try another filter or search term." : "Recorded calls and request updates will appear here. Refresh to check for new activity."}</p></div>}
  </>;
}
