"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "./gsapSetup";
import s from "./GuardianHome.module.css";

const journey = [
  { label: "A familiar phone call", title: "Her usual groceries.\nHer own words.", body: "Ruth calls a regular phone number and asks for what she needs. No downloads, passwords, or new habits to learn.", quote: "“Some milk, eggs, and that bread I like, please.”", caption: "01 / Ruth makes the call", icon: "phone" },
  { label: "A thoughtful safety check", title: "A little pause.\nA lot of protection.", body: "Guardian checks the request for scam signals and family rules. Anything unusual waits for a family decision before action.", quote: "The request is checked before anything moves forward.", caption: "02 / Guardian reviews the request", icon: "shield" },
  { label: "Everyone in the loop", title: "She gets on with life.\nYou stay in the know.", body: "A clear update reaches the family dashboard, so you can see what was requested, what was checked, and where your input is needed.", quote: "Groceries requested. Safety reviewed. Family informed.", caption: "03 / The family receives an update", icon: "check" },
];

function Icon({ kind, className }: { kind: string; className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "phone" ? <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z" /> : kind === "shield" ? <><path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5l8-3Z" /><path d="m8 11 3 3 5-6" /></> : kind === "arrow" ? <path d="M4 12h16m-6-6 6 6-6 6" /> : <path d="m5 12 4 4L19 6" />}
  </svg>;
}

// Composition and staggered reveal approach adapted from 21st.dev's
// Editorial Collage Hero by felipemenezes098 (demo 19074).
// Uses the existing GSAP runtime instead of introducing Motion and Balancer.
export function GuardianHome() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from("[data-intro]", { y: 26, opacity: 0, duration: 0.9, stagger: 0.12, ease: "power3.out", clearProps: "all" });
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, { y: 32, opacity: 0, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, clearProps: "all" });
        });
      }, root);
      return () => ctx.revert();
    });
    // Workflow steps remain readable without animation or JavaScript.
    const triggers = journey.map((_, i) => ScrollTrigger.create({
      trigger: `#guardian-step-${i}`, start: "top 55%", end: "bottom 55%",
      onEnter: () => setActive(i), onEnterBack: () => setActive(i),
    }));
    let disposed = false;
    document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
    return () => { disposed = true; mm.revert(); triggers.forEach(t => t.kill()); };
  }, []);

  const links = [["How it works", "#how-it-works"], ["For families", "#families"], ["Safety", "#safety"], ["Our approach", "#approach"]];

  return <div ref={root} className={s.home}>
    <header className={s.nav}>
      <a href="#home" className={s.wordmark} aria-label="Guardian home"><span className={s.brandMark}>g</span>guardian<span className={s.brandDot}>.</span></a>
      <nav className={s.navLinks} aria-label="Primary">
        {links.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <a className={s.navCta} href="/dashboard">Family dashboard <Icon kind="arrow" /></a>
      <button type="button" className={s.menuButton} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="guardian-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close −" : "Menu +"}</button>
      <nav id="guardian-mobile-nav" className={s.mobileNav} hidden={!menuOpen} aria-label="Mobile primary">{links.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
    </header>

    <section id="home" className={s.hero} aria-labelledby="guardian-title">
      <div className={s.heroCopy}>
        <p data-intro className={s.eyebrow}><span /> A familiar voice. A little more freedom.</p>
        <h1 data-intro id="guardian-title">Life on their terms.<br /><em>A little help</em><br />on the line.</h1>
        <p data-intro className={s.heroBody}>Everyday help for your parent, over a regular phone call. Thoughtful safeguards and a clear view for you, quietly built in.</p>
        <div data-intro className={s.heroActions}><a href="#how-it-works" className={s.button}>Meet Guardian <Icon kind="arrow" /></a><span>No apps for them.<br />More peace of mind for you.</span></div>
      </div>
      <div data-intro className={s.heroArt}>
        <div className={s.photo}><Image src="/images/guardian-hero-kitchen.png" alt="A sunlit kitchen with fresh groceries, ready for another day at home" fill priority sizes="(max-width: 760px) 100vw, 52vw" /><span className={s.photoLabel}>The everyday. Made a little easier.</span></div>
        <div className={s.callNote}><span className={s.noteIcon}><Icon kind="phone" /></span><div><span className={s.smallLabel}>It starts with a call</span><p>“Just my usual, please.”</p></div><span className={s.sound} aria-hidden="true"><i /><i /><i /><i /><i /></span></div>
        <div className={s.photoNumber}>01 <span>/ A little more independence</span></div>
      </div>
    </section>

    <div className={s.promiseBar}><span>Familiar for them.</span><span>Thoughtful behind the scenes.</span><span>Reassuring for you.</span></div>

    <section id="approach" className={s.intro}>
      <p data-reveal className={s.eyebrow}>Less managing. More living.</p>
      <h2 data-reveal>Growing older shouldn’t mean<br />giving up the <em>everyday.</em></h2>
      <div data-reveal className={s.introBottom}><span className={s.sectionNumber}>A little help goes a long way ↘</span><p>The grocery list. A prescription refill request. The small things that make home feel like home. Guardian helps older adults ask naturally, while giving families a thoughtful way to stay close.</p></div>
    </section>

    <section id="how-it-works" className={s.workflow} aria-labelledby="workflow-title">
      <div className={s.workflowHeader} data-reveal><p className={s.eyebrow}>One call. A carefully handled journey.</p><h2 id="workflow-title">Simple on the surface.<br /><em>Thoughtful underneath.</em></h2></div>
      <div className={s.workflowGrid}>
        <div className={s.storyVisual}>
          <div className={s.storyTabs} aria-label="Explore the call journey">{journey.map((step, i) => <a key={step.label} href={`#guardian-step-${i}`} aria-current={active === i ? "step" : undefined} className={active === i ? s.activeTab : ""} onClick={() => setActive(i)}><span>0{i + 1}</span><span className={s.tabText}>{["Call", "Check", "Update"][i]}</span></a>)}</div>
          <div className={s.storyCanvas}>
            <span className={s.orbit} aria-hidden="true" />
            <div className={s.largeIcon}><Icon kind={journey[active].icon} /></div>
            <span className={s.canvasLabel}>{["Ruth’s regular phone", "Guardian’s safety review", "The family dashboard"][active]}</span>
            <p key={active} className={s.canvasQuote}>{journey[active].quote}</p>
            <div className={s.workflowStatus}><span />{["A familiar way to ask", "Family rules come first", "A clear update, in one place"][active]}</div>
            <span className={s.illustrationLabel}>Illustrative experience</span>
          </div>
          <div className={s.progressTrack} aria-hidden="true"><span style={{ width: `${((active + 1) / 3) * 100}%` }} /></div>
          <p className={s.storyCaption}>{journey[active].caption}</p>
        </div>
        <div className={s.storySteps}>{journey.map((step, i) => <article id={`guardian-step-${i}`} key={step.label} className={s.storyStep} data-reveal><span className={s.stepNumber}>0{i + 1}</span><div><p className={s.eyebrow}>{step.label}</p><h3>{step.title}</h3><p className={s.body}>{step.body}</p>{i === 2 && <a className={s.textLink} href="/dashboard">Explore the family dashboard <Icon kind="arrow" /></a>}</div></article>)}</div>
      </div>
      <p className={s.technology}>Natural conversation with ElevenLabs <span>·</span> Request coordination with CREAO <span>·</span> Safeguards before action</p>
    </section>

    <section id="safety" className={s.safety}>
      <div data-reveal className={s.safetyHeading}><span className={s.safetySeal}><Icon kind="shield" /></span><p className={s.eyebrow}>Care, with boundaries.</p><h2>Helpful shouldn’t<br />mean <em>unguarded.</em></h2><p className={s.body}>Independence works better with thoughtful safeguards. Guardian puts a review between a request and an action.</p></div>
      <div data-reveal className={s.safetyDetails}>{[
        ["01", "Scam signals, checked early", "Suspicious urgency, requests for secrecy, and unusual payment demands are reviewed before a request moves forward."],
        ["02", "Your family’s rules come first", "Spending limits and familiar-item rules help determine what can proceed and what needs a family decision."],
        ["03", "A clear reason behind each update", "See the request and its review in the family dashboard, with approvals when your input is needed."],
      ].map(([num, title, body], i) => <details key={num} open={i === 0 ? true : undefined}><summary><span>{num}</span>{title}<b aria-hidden="true">+</b></summary><p>{body}</p></details>)}</div>
    </section>

    <section id="families" className={s.family}>
      <div className={s.familyCopy} data-reveal><p className={s.eyebrow}>For the people who care.</p><h2>Stay close.<br /><em>Without hovering.</em></h2><p className={s.body}>You don’t need to be on every call to feel informed. See requests, understand safety checks, and step in when a decision needs you.</p><a href="/dashboard" className={s.button}>Explore the family dashboard <Icon kind="arrow" /></a><span className={s.quietNote}>Their phone call. Your separate family view.</span></div>
      <div className={s.dashboard} data-reveal role="img" aria-label="Illustrative family dashboard showing Ruth's grocery request, completed safety review, and a request awaiting family approval">
        <div className={s.dashboardTop}><span className={s.miniBrand}>guardian.</span><span className={s.avatar}>EA</span></div><span className={s.smallLabel}>Your family, at a glance</span><h3>A little less to wonder about.</h3><div className={s.member}><span>R</span><div><strong>Ruth’s requests</strong><small>A clear view of the everyday</small></div><span className={s.connected}>Family view</span></div><div className={s.request}><div><Icon kind="phone" /><strong>Grocery request</strong><span>Reviewed</span></div><p>Milk, eggs, and her usual bread.</p><div className={s.review}><Icon kind="shield" /> Safety review complete</div></div><div className={s.approval}><span className={s.approvalDot} /><div><strong>You’re part of the decision.</strong><p>Requests outside family rules wait for approval.</p></div></div><span className={s.sampleLabel}>Illustrative dashboard · Sample request</span>
      </div>
    </section>

    <section className={s.closing} data-reveal><p className={s.eyebrow}>A little help. A lot of life.</p><h2>More independence for them.<br /><em>More peace of mind for you.</em></h2><a href="#how-it-works" className={s.button}>See how it comes together <Icon kind="arrow" /></a></section>
    <footer className={s.footer}><a href="#home" className={s.wordmark}>guardian.</a><p>Everyday help. A familiar way to ask.</p><a href="/dashboard">Family dashboard ↗</a><a href="#home">Back to top ↑</a></footer>
  </div>;
}
