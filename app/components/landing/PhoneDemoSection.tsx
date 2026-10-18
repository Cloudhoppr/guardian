"use client";

import { useLayoutEffect, useRef } from "react";

import styles from "./PhoneDemoSection.module.css";
import { gsap, prefersReducedMotion } from "./gsapSetup";

const EXPLANATIONS = [
  { step: "01", text: "Ruth calls naturally." },
  { step: "02", text: "Guardian understands the request." },
  { step: "03", text: "Safety checks happen before action." },
  { step: "04", text: "Family receives a clear update." },
] as const;

const LINE_LENGTH = 900; // approximate length of the connectorLine path below

export function PhoneDemoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const explanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !sectionRef.current) return;

    const line = lineRef.current;
    const phone = phoneRef.current;
    const explanations = explanationRefs.current.filter(Boolean) as HTMLDivElement[];

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Desktop: .phone is centered via a CSS `translate(-50%, -50%)`. GSAP's
      // `y` tween takes over the whole `transform` property, so without
      // reasserting xPercent/yPercent here the centering gets silently wiped
      // and the phone renders off-position, clipped by the section's overflow.
      mm.add("(min-width: 861px)", () => {
        if (phone) {
          gsap.set(phone, { opacity: 0, y: 30, xPercent: -50, yPercent: -50 });
        }
        buildTimeline({ xPercent: -50, yPercent: -50 });
      });

      // Mobile: .phone is `position: static`, no competing transform.
      mm.add("(max-width: 860px)", () => {
        if (phone) {
          gsap.set(phone, { opacity: 0, y: 30 });
        }
        buildTimeline({});
      });

      function buildTimeline(phoneRestProps: gsap.TweenVars) {
        if (line) {
          gsap.set(line, { strokeDasharray: LINE_LENGTH, strokeDashoffset: LINE_LENGTH });
        }
        gsap.set(explanations, { opacity: 0, y: 16 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
        });

        if (line) {
          tl.to(line, { strokeDashoffset: 0, duration: 1.1, ease: "power2.out" }, 0);
        }
        if (phone) {
          tl.to(phone, { opacity: 1, y: 0, ...phoneRestProps, duration: 0.7, ease: "power2.out" }, 0.2);
        }
        tl.to(explanations, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.18 }, 0.5);

        return () => tl.scrollTrigger?.kill();
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-label="How a Guardian call looks">
      <svg className={styles.connectorLine} viewBox="0 0 900 420" preserveAspectRatio="none" aria-hidden="true">
        <path
          ref={lineRef}
          d="M0 40C180 40 180 180 360 200C540 220 540 60 720 80C820 90 860 160 900 180"
          stroke="#8173b5"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <h2 className={styles.title}>Support that starts with a call.</h2>

      <div className={styles.stage}>
        <div
          ref={(el) => {
            explanationRefs.current[0] = el;
          }}
          className={`${styles.explanation} ${styles.explanation0}`}
        >
          <span className={styles.step}>{EXPLANATIONS[0].step}</span>
          <p className={styles.explanationText}>{EXPLANATIONS[0].text}</p>
        </div>
        <div
          ref={(el) => {
            explanationRefs.current[1] = el;
          }}
          className={`${styles.explanation} ${styles.explanation1}`}
        >
          <span className={styles.step}>{EXPLANATIONS[1].step}</span>
          <p className={styles.explanationText}>{EXPLANATIONS[1].text}</p>
        </div>

        <div
          ref={phoneRef}
          className={styles.phone}
          role="img"
          aria-label="Guardian call summary shown on a phone after a call with Ruth"
        >
          <div className={styles.phoneNotch} aria-hidden="true" />
          <div className={styles.phoneScreen}>
            <p className={styles.callStatus}>Call ended</p>
            <div className={styles.callIdentity}>
              <div className={styles.callAvatar} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className={styles.callName}>Guardian</div>
              <div className={styles.callDuration}>2:14</div>
            </div>
            <div className={styles.callRecap}>
              <div className={styles.recapRow}>
                <span className={styles.recapDotDone} aria-hidden="true" />
                Groceries requested
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapDotDone} aria-hidden="true" />
                Reviewed for safety
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapDotDone} aria-hidden="true" />
                Family notified
              </div>
            </div>
          </div>
        </div>

        <div
          ref={(el) => {
            explanationRefs.current[2] = el;
          }}
          className={`${styles.explanation} ${styles.explanation2}`}
        >
          <span className={styles.step}>{EXPLANATIONS[2].step}</span>
          <p className={styles.explanationText}>{EXPLANATIONS[2].text}</p>
        </div>
        <div
          ref={(el) => {
            explanationRefs.current[3] = el;
          }}
          className={`${styles.explanation} ${styles.explanation3}`}
        >
          <span className={styles.step}>{EXPLANATIONS[3].step}</span>
          <p className={styles.explanationText}>{EXPLANATIONS[3].text}</p>
        </div>
      </div>

      <div className={styles.transitionToPlum} aria-hidden="true" />
    </section>
  );
}
