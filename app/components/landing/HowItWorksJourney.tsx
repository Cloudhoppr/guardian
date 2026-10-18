"use client";

import { useLayoutEffect, useRef } from "react";

import styles from "./HowItWorksJourney.module.css";
import { gsap, prefersReducedMotion } from "./gsapSetup";

const STEPS = [
  { title: "Ruth calls", text: "A regular phone call, whenever she needs something." },
  { title: "Guardian checks", text: "The request is understood and reviewed before anything happens." },
  { title: "Family stays informed", text: "A clear, calm update lands in the family dashboard." },
] as const;

const CONNECTOR_LENGTH = 860; // length of the straight M20,20 H880 path

export function HowItWorksJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const connectorRef = useRef<SVGPathElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !sectionRef.current) return;

    const connector = connectorRef.current;
    const steps = stepRefs.current.filter(Boolean) as HTMLLIElement[];

    const ctx = gsap.context(() => {
      if (connector) {
        gsap.set(connector, { strokeDasharray: CONNECTOR_LENGTH, strokeDashoffset: CONNECTOR_LENGTH });
      }
      gsap.set(steps, { opacity: 0, y: 24 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          end: "bottom 55%",
          scrub: 0.6,
        },
      });

      if (connector) {
        tl.to(connector, { strokeDashoffset: 0, ease: "none", duration: 1 }, 0);
      }
      steps.forEach((step, i) => {
        tl.to(step, { opacity: 1, y: 0, ease: "power1.out", duration: 0.3 }, i * 0.3);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className={styles.section}
      aria-label="How a Guardian call moves through the system"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>How it works</p>

        <svg className={styles.connector} viewBox="0 0 900 40" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path className={styles.connectorTrack} d="M20 20 H880" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <path ref={connectorRef} className={styles.connectorFlow} d="M20 20 H880" stroke="#8173b5" strokeWidth="1" />
        </svg>

        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={styles.step}
            >
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
