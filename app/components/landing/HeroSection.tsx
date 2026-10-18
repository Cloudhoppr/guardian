import styles from "./HeroSection.module.css";

const NAV_LINKS = ["How it works", "For families", "Safety", "Our approach"];

export function HeroSection() {
  return (
    <section className={styles.hero} aria-label="Guardian introduction">
      <div
        className={styles.heroBackground}
        role="img"
        aria-label="Warm, sunlit home kitchen with fresh groceries on the counter"
      />
      <div className={styles.heroOverlayLeft} aria-hidden="true" />
      <div className={styles.heroOverlayBottom} aria-hidden="true" />

      <svg className={styles.connectionArc} width="420" height="820" viewBox="0 0 420 820" fill="none" aria-hidden="true">
        <path
          d="M400 0C300 120 300 260 360 380C420 500 340 620 380 820"
          stroke="#8173B5"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
      <svg className={styles.connectionArcRight} width="300" height="700" viewBox="0 0 300 700" fill="none" aria-hidden="true">
        <path d="M0 40C80 160 60 320 140 420C220 520 160 620 220 700" stroke="#8173B5" strokeWidth="1" strokeLinecap="round" />
      </svg>

      <header className={styles.nav}>
        <div className={styles.navWordmark}>guardian.</div>
        <nav className={styles.navLinks} aria-label="Primary">
          {NAV_LINKS.map((label) => (
            <a key={label} href="#" className={styles.navLink}>
              {label}
            </a>
          ))}
        </nav>
        <a href="/dashboard" className={styles.navCta}>
          Explore Guardian
        </a>
      </header>

      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Independence, with peace of mind</p>
        <h1 className={styles.headline}>
          A little help.
          <br />
          A lot more
          <br />
          independence.
        </h1>
        <p className={styles.support}>
          Ruth gets help over a regular phone call — no apps, no screens to learn —
          while thoughtful safeguards and family visibility work quietly in the
          background.
        </p>
        <div className={styles.ctaRow}>
          <a href="#features" className={styles.primaryCta}>
            See how Guardian works
          </a>
          <a href="/dashboard" className={styles.secondaryCta}>
            Explore the family dashboard
          </a>
        </div>
      </div>
    </section>
  );
}
