"use client";

import { useEffect, useRef } from "react";

import styles from "./GuardianFeatureMap.module.css";
import { gsap, ScrollTrigger } from "./gsapSetup";

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

// Adapted reveal choreography from cnippet-dev's 21st.dev Scroll Reveal.
// GSAP owns both the reveals and the SVG drawing; Motion is not needed.
export function GuardianFeatureMap() {
  const sectionRef = useRef<HTMLElement>(null);
  const journeyRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const journey = journeyRef.current;
    if (!section || !journey) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        desktop: "(min-width: 761px)",
        mobile: "(max-width: 760px)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        if (context.conditions?.reduced) return;

        const rows = Array.from(journey.querySelectorAll<HTMLElement>("[data-milestone]"));
        const paths = rows.map((row) => row.querySelector<SVGPathElement>(
          context.conditions?.desktop ? "[data-desktop-path]" : "[data-mobile-path]",
        )!);
        const copies = rows.map((row) => row.querySelector<HTMLElement>("[data-copy]")!);
        const dots = rows.map((row) => row.querySelector<HTMLElement>("[data-dot]")!);

        // Only enhance after initialization: server HTML and reduced-motion mode
        // always expose the complete story and a fully drawn connecting line.
        paths.forEach((path) => {
          const length = path.getTotalLength();
          gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        });
        gsap.set(copies, { opacity: 0, y: 22 });
        gsap.set(dots, { scale: 0.65, backgroundColor: "#f8f3f0" });

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: journey,
            start: "top 85%",
            end: "bottom 62%",
            scrub: 0.35,
            invalidateOnRefresh: true,
          },
        });

        rows.forEach((_, index) => {
          const beat = index;
          timeline
            .to(paths[index], { strokeDashoffset: 0, duration: 0.55, ease: "power1.inOut" }, beat)
            .to(dots[index], { scale: 1, backgroundColor: "#8173b5", duration: 0.18 }, beat + 0.4)
            .to(copies[index], { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" }, beat + 0.35);
          if (index > 0) {
            timeline.to(copies[index - 1], { opacity: 0.82, duration: 0.3 }, beat + 0.4);
            timeline.to(dots[index - 1], { scale: 0.75, duration: 0.3 }, beat + 0.4);
          }
          // Leave the line still while each milestone has its reading beat.
          timeline.to({}, { duration: 0.27 }, beat + 0.73);
        });

      },
      section,
    );

    // Local web fonts can change the heading after the first measurement.
    let disposed = false;
    document.fonts.ready.then(() => {
      if (!disposed) ScrollTrigger.refresh();
    });
    return () => {
      disposed = true;
      mm.revert();
    };
  }, []);

  return (
    <section id="features" ref={sectionRef} className={styles.section} aria-labelledby="features-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>What Guardian solves</p>
        <h2 id="features-title" className={styles.title}>One call, a lot quietly handled.</h2>
      </div>

      <ol ref={journeyRef} className={styles.journey}>
        {FEATURE_POINTS.map((point, index) => {
          const left = index % 2 === 0;
          const previousX = index === 0 ? 500 : left ? 560 : 440;
          const x = left ? 440 : 560;
          return (
            <li key={point.id} className={styles.milestone} data-milestone>
              <svg className={styles.desktopLine} viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true">
                <path
                  data-desktop-path
                  d={`M ${previousX} 0 C ${previousX} 110, ${x} 150, ${x} 260`}
                  className={styles.line}
                />
              </svg>
              <svg className={styles.mobileLine} viewBox="0 0 56 260" preserveAspectRatio="none" aria-hidden="true">
                <path data-mobile-path d="M 28 0 C 62 85, -6 175, 28 260" className={styles.line} />
              </svg>
              <span className={styles.dot} data-dot aria-hidden="true" />
              <div className={styles.copy} data-copy>
                <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")} / 06</span>
                <h3 className={styles.label}>{point.label}</h3>
                <p className={styles.explanation}>{point.explanation}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
