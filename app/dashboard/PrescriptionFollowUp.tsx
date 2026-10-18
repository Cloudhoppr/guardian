import { DashboardIcon } from "./DashboardIcon";
import s from "./dashboard.module.css";

type PrescriptionRecord = { id: string; drug: string; refillsLeft: number; rxNumber: string; lastFilledOn: string | null };

export function PrescriptionFollowUp({ records }: { records: PrescriptionRecord[] }) {
  const renewals = records.filter(rx => rx.refillsLeft <= 0);
  return <section id="prescriptions" className={s.routinePanel}>
    <div className={s.panelHeading}><div><p className={s.eyebrow}>Know what needs a follow-up</p><h2>Refill follow-up.</h2></div><DashboardIcon name="prescription" /></div>
    {records.length ? <>
      {renewals.length ? <div className={s.renewalNotice}><span className={s.warningBadge}>Renewal follow-up</span><h3>{renewals.length} prescription{renewals.length === 1 ? " has" : "s have"} no refills recorded.</h3><ul>{renewals.map(rx => <li key={rx.id}>{rx.drug}</li>)}</ul><p>Contact the prescribing office about a renewal. Guardian’s refill workflow cannot renew a prescription.</p></div> : <p className={s.refillSummary}>The listed records have refills remaining. No renewal follow-up is flagged in these records.</p>}
      <details className={s.prescriptionRecords}><summary>View refill records <span>{records.length} <b aria-hidden="true">+</b></span></summary><ul>{records.map(rx => <li key={rx.id}><strong>{rx.drug}</strong><span className={rx.refillsLeft <= 0 ? s.refillWarning : s.refillText}>{rx.refillsLeft <= 0 ? "No refills recorded · renewal follow-up" : `${rx.refillsLeft} recorded refill${rx.refillsLeft === 1 ? "" : "s"} remaining`}</span><dl><div><dt>Prescription</dt><dd>Ending {rx.rxNumber.slice(-4)}</dd></div><div><dt>Last filled</dt><dd>{rx.lastFilledOn ?? "Not recorded"}</dd></div></dl></li>)}</ul></details>
      <div className={s.refillWorkflow}><DashboardIcon name="phone" size={17} /><p>Refill requests start with a regular Guardian phone call. This view helps families spot follow-ups; it does not submit a refill or confirm pickup.</p></div>
      <p className={s.panelFootnote}>Up to 3 recently updated records. Refill counts are stored records, not live pharmacy availability.</p>
    </> : <p className={s.emptyNote}>No prescription records are linked yet. Renewal follow-ups will appear here when records are available.</p>}
  </section>;
}
