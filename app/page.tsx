import { DM_Serif_Display, Inter } from "next/font/google";

import styles from "./page.module.css";

const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const NAV_LINKS = ["How it works", "For families", "Safety", "Our approach"];

const WAVEFORM_HEIGHTS = [6, 12, 16, 9, 14, 5];
const WAVEFORM_HEIGHTS_DIM = [11, 7];

export default function LandingPage() {
  return (
    <main className={`${serif.variable} ${sans.variable}`}>
      <section className={styles.hero}>
        <div className={styles.heroBackground} />
        <div className={styles.heroOverlayLeft} />
        <div className={styles.heroOverlayBottom} />

        <nav className={styles.nav}>
          <div className={styles.navWordmark}>guardian.</div>
          <div className={styles.navLinks}>
            {NAV_LINKS.map((label) => (
              <a key={label} href="#" className={styles.navLink}>
                {label}
              </a>
            ))}
          </div>
          <a href="/dashboard" className={styles.navCta}>
            Explore Guardian
          </a>
        </nav>

        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Independence, with peace of mind</div>
          <h1 className={styles.headline}>
            A little help.
            <br />
            A lot more
            <br />
            independence.
          </h1>
          <p className={styles.support}>
            Groceries, prescriptions, and everyday essentials — handled through a
            simple conversation, with thoughtful safeguards and family visibility
            built in.
          </p>
          <div className={styles.ctaRow}>
            <a href="#how-it-works" className={styles.primaryCta}>
              See how Guardian works
            </a>
            <a href="/dashboard" className={styles.secondaryCta}>
              Explore the family dashboard →
            </a>
          </div>
        </div>

        <div className={styles.voiceCard}>
          <div className={styles.voiceTopRow}>
            <div className={styles.micBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="white" />
                <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M12 18v3" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className={styles.voiceLabels}>
              <div className={styles.voiceTitle}>Listening</div>
              <div className={styles.voiceSubtitle}>Ruth · just now</div>
            </div>
          </div>
          <div className={styles.waveform}>
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <div key={i} className={styles.waveformBar} style={{ height: h }} />
            ))}
            {WAVEFORM_HEIGHTS_DIM.map((h, i) => (
              <div key={`dim-${i}`} className={styles.waveformBarDim} style={{ height: h }} />
            ))}
          </div>
          <p className={styles.voiceQuote}>&ldquo;Order my usual groceries, please.&rdquo;</p>
        </div>
      </section>
    </main>
  );
}
