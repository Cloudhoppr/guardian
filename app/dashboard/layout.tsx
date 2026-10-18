export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Guardian</h1>
        <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
          <a href="/dashboard">Family</a>
          <a href="/senior">Senior view</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
