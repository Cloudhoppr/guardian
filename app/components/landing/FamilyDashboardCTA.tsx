"use client";

import { useLayoutEffect, useRef } from "react";

import styles from "./FamilyDashboardCTA.module.css";
import { gsap, prefersReducedMotion } from "./gsapSetup";

export function FamilyDashboardCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      if (arcRef.current) {
        gsap.set(arcRef.current, { strokeDasharray: 700, strokeDashoffset: 700 });
      }
      if (copyRef.current) {
        gsap.set(copyRef.current, { opacity: 0, y: 24 });
      }
      if (cardRef.current) {
        gsap.set(cardRef.current, { opacity: 0, y: 40, rotate: -4 });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 65%",
          toggleActions: "play none none reverse",
        },
      });

      if (arcRef.current) {
        tl.to(arcRef.current, { strokeDashoffset: 0, duration: 1.2, ease: "power2.out" }, 0);
      }
      if (copyRef.current) {
        tl.to(copyRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.1);
      }
      if (cardRef.current) {
        tl.to(cardRef.current, { opacity: 1, y: 0, rotate: -4, duration: 0.7, ease: "power2.out" }, 0.3);
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-label="Family dashboard">
      <svg className={styles.bgRing} viewBox="0 0 700 700" aria-hidden="true">
        <circle cx="350" cy="350" r="300" />
      </svg>
      <svg className={styles.bgArc} viewBox="0 0 1200 500" preserveAspectRatio="none" aria-hidden="true">
        <path
          ref={arcRef}
          d="M0 420C220 420 220 260 440 260C660 260 660 420 900 380C1040 356 1100 280 1200 200"
          stroke="#8173b5"
          strokeWidth="1"
          fill="none"
        />
      </svg>

      <div className={styles.inner}>
        <div ref={copyRef} className={styles.copy}>
          <p className={styles.eyebrow}>For families</p>
          <h2 className={styles.heading}>The call ends. The visibility stays.</h2>
          <p className={styles.support}>
            Every completed call becomes a calm, useful update in the family
            dashboard — with no guesswork and no need to interrupt.
          </p>
          <a href="/dashboard" className={styles.cta}>
            View dashboard preview
            <span className={styles.ctaArrow} aria-hidden="true">
              →
            </span>
          </a>
        </div>

        <div ref={cardRef} className={styles.previewCard} aria-hidden="true">
          <div className={styles.previewHeader}>
            <span className={styles.previewEyebrow}>Family overview</span>
            <span className={styles.previewAvatar}>EA</span>
          </div>
          <div className={styles.previewGreeting}>Good morning, Elena.</div>
          <div className={styles.previewRow}>
            <span className={styles.previewDotDone} />
            <span className={styles.previewRowLabel}>Latest order</span>
            <span className={styles.previewRowValue}>$84.60 · Approved</span>
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewDotDone} />
            <span className={styles.previewRowLabel}>Safety review</span>
            <span className={styles.previewRowValue}>Low risk</span>
          </div>
          <div className={styles.previewFooter}>View full dashboard →</div>
        </div>
      </div>
    </section>
  );
}
