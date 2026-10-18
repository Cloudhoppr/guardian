import type { CSSProperties } from "react";

export function DashboardIcon({ name, size = 20, style }: { name: "overview" | "activity" | "shield" | "prescription" | "arrow" | "refresh" | "phone" | "bag" | "check"; size?: number; style?: CSSProperties }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    activity: <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2" /></>,
    shield: <><path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z" /><path d="m8 11 3 3 5-6" /></>,
    prescription: <><path d="m9 4-5 5a6.36 6.36 0 0 0 9 9l5-5a6.36 6.36 0 0 0-9-9Z" /><path d="m7 7 10 10" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></>,
    phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z" />,
    bag: <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
