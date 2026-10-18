"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./GuardianFeatureMap.module.css";
import { ScrollTrigger, gsap, prefersReducedMotion } from "./gsapSetup";

const FEATURE_POINTS = [
  {
    id: "errands",
    label: "Everyday errands",
    explanation: "Ruth can ask for groceries or household basics with a quick call — no apps, no typing.",
  },
  {
    id: "prescriptions",
    label: "Prescription support",
    explanation: "Refill requests go through the same simple call, checked against her usual prescriptions.",
  },
  {
    id: "scam",
    label: "Scam protection",
    explanation: "Unusual or risky requests are reviewed before anything happens.",
  },
  {
    id: "visibility",
    label: "Family visibility",
    explanation: "Elena sees what happened and why, without needing to ask.",
  },
  {
    id: "approval",
    label: "Approval before action",
    explanation: "Anything outside the ordinary waits for a family decision first.",
  },
  {
    id: "independence",
    label: "Independence at home",
    explanation: "Ruth keeps living life her way — Guardian just makes the small things easier.",
  },
] as const;

// Matches the ring geometry below (viewBox 680x680, r=272) so the drawn arc's
// leading edge lines up with each point's angular position on the circle.
const RING_RADIUS = 272;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DESKTOP_BREAKPOINT = 760; // keep in sync with the CSS circle/list breakpoint

export function GuardianFeatureMap() {
  const sectionRef = useRef<HTMLElement>(null);
  const ringPathRef = useRef<SVGPathElement>(null);
  const [manualId, setManualId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState<number>(FEATURE_POINTS.length);
  const [activeIndex, setActiveIndex] = useState<number>(FEATURE_POINTS.length - 1);
  const [scrollDriven, setScrollDriven] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || !sectionRef.current || !ringPathRef.current) {
      return;
    }

    const ringPath = ringPathRef.current;

    // ScrollTrigger.matchMedia re-evaluates on resize/orientation change, so
    // a window crossing the desktop breakpoint (not just the initial mount
    // width) correctly switches between the pinned circle and the plain,
    // always-visible state the mobile stacked list expects.
    const mm = gsap.matchMedia();

    mm.add(`(min-width: ${DESKTOP_BREAKPOINT}px)`, () => {
      setScrollDriven(true);
      setRevealedCount(0);
      setActiveIndex(-1);
      ringPath.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
      ringPath.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;

      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: () => "+=" + window.innerHeight * 2.6,
        pin: true,
        scrub: 0.4,
        anticipatePin: 1,
        onUpdate: (self) => {
          const progress = self.progress;
          gsap.set(ringPath, { strokeDashoffset: RING_CIRCUMFERENCE * (1 - progress) });

          const index = Math.min(FEATURE_POINTS.length - 1, Math.floor(progress * FEATURE_POINTS.length));
          setActiveIndex((prev) => (prev === index ? prev : index));
          setRevealedCount((prev) => {
            const next = progress <= 0 ? 0 : index + 1;
            return prev === next ? prev : next;
          });
        },
      });

      return () => {
        trigger.kill();
        setScrollDriven(false);
        setRevealedCount(FEATURE_POINTS.length);
        setActiveIndex(FEATURE_POINTS.length - 1);
      };
    });

    return () => mm.revert();
  }, []);

  function handleSelect(id: string) {
    setManualId((current) => (current === id ? null : id));
  }

  const activePoint =
    (manualId && FEATURE_POINTS.find((p) => p.id === manualId)) ||
    (activeIndex >= 0 ? FEATURE_POINTS[activeIndex] : null);

  return (
    <section
      id="features"
      ref={sectionRef}
      className={styles.section}
      aria-label="What Guardian helps with"
    >
      <div className={styles.heading}>
        <p className={styles.eyebrow}>What Guardian solves</p>
        <h2 className={styles.title}>One call, a lot quietly handled.</h2>
      </div>

      <div className={styles.map} data-scroll-driven={scrollDriven || undefined}>
        <svg className={styles.ringSvg} viewBox="0 0 680 680" aria-hidden="true">
          <circle className={styles.ringTrack} cx="340" cy="340" r={RING_RADIUS} />
          <path
            ref={ringPathRef}
            className={styles.ringPath}
            d="M340 68 A272 272 0 1 1 340 612 A272 272 0 1 1 340 68"
          />
        </svg>

        <div className={styles.center} aria-live="polite">
          {activePoint ? (
            <div className={styles.centerSelected}>
              <div className={styles.centerSelectedLabel}>{activePoint.label}</div>
              <p className={styles.centerSelectedText}>{activePoint.explanation}</p>
              {manualId ? (
                <button type="button" className={styles.centerBack} onClick={() => setManualId(null)}>
                  ← Guardian
                </button>
              ) : null}
            </div>
          ) : (
            <div className={styles.centerDefault}>
              <div className={styles.centerWord}>Guardian</div>
              <p className={styles.centerHint}>Keep scrolling</p>
            </div>
          )}
        </div>

        <ul className={styles.pointList}>
          {FEATURE_POINTS.map((point, i) => {
            const revealed = i < revealedCount;
            const isActive = activePoint?.id === point.id;
            return (
              <li
                key={point.id}
                className={`${styles.pointItem} ${styles[`pointItem${i + 1}` as keyof typeof styles]} ${revealed ? styles.pointItemRevealed : ""}`}
              >
                <button
                  type="button"
                  className={`${styles.pointButton} ${isActive ? styles.pointButtonActive : ""}`}
                  aria-pressed={isActive}
                  aria-expanded={manualId === point.id}
                  aria-hidden={!revealed}
                  tabIndex={revealed ? 0 : -1}
                  onClick={() => handleSelect(point.id)}
                >
                  <span className={styles.pointDot} aria-hidden="true" />
                  <span className={styles.pointLabel}>{point.label}</span>
                </button>
                <p className={styles.pointExplanation} hidden={manualId !== point.id}>
                  {point.explanation}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
