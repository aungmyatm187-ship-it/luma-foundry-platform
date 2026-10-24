/**
 * Signal Atelier design reminder: digital neo-editorialism with an asymmetric production wall,
 * inky surfaces, prismatic glass, and signal cyan/violet used only for focus and live states.
 */
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CirclePlay,
  Command,
  Layers3,
  Menu,
  MoveUpRight,
  Orbit,
  PanelTop,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import lumaStyles from "./luma-intelligence.css?raw";

const caseStudies = [
  {
    title: "Customer intelligence",
    type: "Signal synthesis",
    image: "/manus-storage/luma-intelligence-synthesis_4cb322c5.png",
    aspect: "portrait",
    number: "01",
    phase: "Synthesis / verified",
    detail: "Turn fragmented feedback into one evidence-led customer narrative.",
  },
  {
    title: "Agent playbooks",
    type: "Orchestrated work",
    image: "/manus-storage/luma-intelligence-agents_352e3e15.png",
    aspect: "landscape",
    number: "02",
    phase: "Agents / supervised",
    detail: "Route recurring research and planning through repeatable, human-approved paths.",
  },
  {
    title: "Decision memory",
    type: "Grounded context",
    image: "/manus-storage/luma-intelligence-memory_62a5a77a.png",
    aspect: "tall",
    number: "03",
    phase: "Memory / connected",
    detail: "Keep the reasoning behind pivotal decisions close to the next question.",
  },
];

const features = [
  {
    eyebrow: "01 / SIGNAL SYNTHESIS",
    title: "Find the thread across every source.",
    body: "Bring customer, product, and market evidence into a single intelligence layer your whole team can inspect.",
    artifact: "Synthesis / 24 sources",
    artifactDetail: "Feedback cluster → retention risk → next question",
    artifactState: "GROUNDED",
    icon: Command,
    className: "md:col-span-7",
  },
  {
    eyebrow: "02 / GROUNDED ANSWERS",
    title: "Ask the hard question in context.",
    body: "Surface an answer with the underlying evidence, open assumptions, and decision trail attached.",
    artifact: "Answer / release readiness",
    artifactDetail: "18 cited signals · 3 open assumptions",
    artifactState: "TRACEABLE",
    icon: Orbit,
    className: "md:col-span-5",
  },
  {
    eyebrow: "03 / AGENT PLAYBOOKS",
    title: "Turn expert motion into a repeatable path.",
    body: "Shape trusted agent workflows around the way your team already researches, plans, and decides.",
    artifact: "Playbook / launch scan",
    artifactDetail: "Research → draft → human review",
    artifactState: "SUPERVISED",
    icon: Layers3,
    className: "md:col-span-5",
  },
  {
    eyebrow: "04 / DECISION MEMORY",
    title: "Never lose the why behind a yes.",
    body: "Preserve the evidence, the owner, and the reasoning that moved a critical decision forward.",
    artifact: "Memory / Q2 priority",
    artifactDetail: "Owner, evidence, and rationale remain linked",
    artifactState: "PERSISTENT",
    icon: PanelTop,
    className: "md:col-span-7",
  },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LumaIntelligence() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-revealed");
        });
      },
      { threshold: 0.12 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const notifyComingSoon = (label: string) => {
    toast(`${label} is staged for the interactive product build.`, {
      description: "This concept page demonstrates the layout, states, and motion system.",
    });
  };

  return (
    <>
      <style>{lumaStyles}</style>
      <div className="min-h-screen overflow-x-clip bg-[#070A12] text-[#F4F6FB] selection:bg-[#5AF4E5] selection:text-[#070A12]">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <nav aria-label="Primary navigation" className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="brand-mark group" aria-label="Luma Intelligence home">
            <img src="/manus-storage/luma-foundry-mark_e8a0bb3e.png" alt="" className="h-10 w-10 transition-transform duration-300 group-hover:rotate-[-5deg]" />
            <span className="brand-type"><strong>LUMA</strong><i> / </i>INTELLIGENCE</span>
          </a>

          <div className="hidden items-center gap-7 text-sm text-[#C7CCDD] md:flex">
            <a className="nav-link" href="#system">Platform</a>
            <a className="nav-link" href="#work">Use cases</a>
            <a className="nav-link" href="#notes">Principle</a>
          </div>

          <div className="hidden md:block">
            <Button className="signal-button h-10 rounded-full px-5 text-xs font-bold uppercase tracking-[0.12em]" onClick={() => notifyComingSoon("Request access")}> 
              Request access <ArrowUpRight className="ml-1 size-3.5" />
            </Button>
          </div>

          <button
            className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white transition duration-300 hover:border-[#5AF4E5]/70 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5AF4E5] md:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0B0F1A]/95 px-5 py-5 backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-[1440px] flex-col gap-1">
              {[
                ["Platform", "system"],
                ["Use cases", "work"],
                ["Principle", "notes"],
              ].map(([label, id]) => (
                <button
                  key={id}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-[#E7EBF4] transition hover:bg-white/5"
                  onClick={() => {
                    scrollToSection(id);
                    setMenuOpen(false);
                  }}
                >
                  {label}<ArrowRight className="size-4 text-[#5AF4E5]" />
                </button>
              ))}
              <Button className="signal-button mt-2 rounded-xl" onClick={() => notifyComingSoon("Request access")}>Request access</Button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        <section id="top" className="hero-shell relative isolate overflow-hidden px-5 pb-14 pt-11 md:px-8 md:pb-24 md:pt-20">
          <div className="hero-lattice" aria-hidden="true" />
          <div className="hero-aura hero-aura-one" aria-hidden="true" />
          <div className="hero-aura hero-aura-two" aria-hidden="true" />

          <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-12 lg:items-end">
            <div className="relative z-10 lg:col-span-6 lg:pb-5">
              <div className="reveal-item mb-7 flex items-center gap-3 text-[10px] font-bold tracking-[0.2em] text-[#9FA8BD]" style={{ animationDelay: "90ms" }}>
                <span className="h-px w-10 bg-gradient-to-r from-[#5AF4E5] to-[#946DFF]" />
                AI OPERATIONS LAYER / 2026
              </div>
              <h1 className="reveal-item max-w-[780px] font-display text-[clamp(3.65rem,8.8vw,8.2rem)] font-bold leading-[0.87] tracking-[-0.075em] text-[#F6F8FF]" style={{ animationDelay: "150ms" }}>
                See the signal. Make the <span className="text-gradient">move.</span>
              </h1>
              <p className="reveal-item mt-7 max-w-xl text-base leading-7 text-[#B7BED0] md:text-lg" style={{ animationDelay: "230ms" }}>
                Luma Intelligence connects the evidence across your company, so teams can move from scattered signals to grounded decisions without losing the why.
              </p>
              <div className="reveal-item mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "310ms" }}>
                <Button className="signal-button group h-12 rounded-full px-6 text-sm font-bold" onClick={() => notifyComingSoon("Your live project board")}>
                  Explore the intelligence layer <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
                <button className="subtle-button h-12 rounded-full px-5 text-sm font-semibold" onClick={() => notifyComingSoon("The product reel")}>
                  <CirclePlay className="size-4 text-[#5AF4E5]" /> See it in motion
                </button>
              </div>
              <div className="reveal-item mt-12 flex items-center gap-4 text-xs text-[#7F899E]" style={{ animationDelay: "390ms" }}>
                <div className="flex -space-x-2" aria-label="A collection of studio avatars">
                  {["#F9B9A7", "#D6CEF9", "#ABE7D9", "#E0C087"].map((color, index) => <span key={color} className="avatar-orb" style={{ background: color, zIndex: 4 - index }} />)}
                </div>
                <span>Built for teams that decide with evidence.</span>
              </div>
            </div>

            <div className="relative z-10 lg:col-span-6" aria-label="A preview of Luma Foundry project activity">
              <div className="hero-workspace reveal-item" style={{ animationDelay: "230ms" }}>
                <img src="/manus-storage/luma-intelligence-hero_82135acf.png" alt="Abstract luminous data planes converging into an AI recommendation" className="absolute inset-0 size-full object-cover opacity-75 mix-blend-screen" />
                <div className="relative flex min-h-[420px] flex-col justify-between p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="glass-label"><span className="status-dot" />Intelligence / Atlas</div>
                    <button onClick={() => notifyComingSoon("Project board controls")} className="glass-icon" aria-label="Open project controls"><MoveUpRight className="size-4" /></button>
                  </div>
                  <div className="relative mx-auto flex size-32 items-center justify-center sm:size-40" aria-hidden="true">
                    <div className="orbit-ring orbit-ring-a" />
                    <div className="orbit-ring orbit-ring-b" />
                    <div className="grid size-14 place-items-center rounded-2xl border border-white/20 bg-[#101829]/80 shadow-[0_0_50px_rgba(90,244,229,0.16)] backdrop-blur-xl sm:size-16"><Sparkles className="size-6 text-[#5AF4E5]" /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <article className="workspace-note">
                      <div className="mb-5 flex items-center justify-between text-[10px] font-bold tracking-[0.15em] text-[#8F9AB2]"><span>NEXT MOVE</span><span className="text-[#5AF4E5]">08:30</span></div>
                      <p className="font-display text-xl font-semibold leading-6 text-white">Draft an evidence-backed launch brief.</p>
                      <div className="mt-5 flex gap-2"><span className="tag">GROUNDED</span><span className="tag">REVIEWED</span></div>
                    </article>
                    <div className="workspace-meter">
                      <span className="text-[10px] font-bold tracking-[0.14em] text-[#9FA8BD]">FLOW</span>
                      <strong className="font-display text-3xl tracking-[-0.08em] text-white">86</strong>
                      <div className="meter-track"><span /></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 right-5 z-20 hidden max-w-[260px] glass-float p-4 md:block">
                <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[#5AF4E5] text-[#071015]"><Check className="size-4" /></span><div><p className="text-xs font-bold text-white">Brief ready for review</p><p className="mt-0.5 text-[11px] text-[#9FA8BD]">18 linked sources</p></div></div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-16 flex max-w-[1440px] justify-between border-t border-white/10 pt-5 text-[10px] font-bold tracking-[0.16em] text-[#808BA0]">
            <span>SCROLL FOR THE INTELLIGENCE LAYER</span><ArrowDownRight className="size-4 text-[#5AF4E5]" />
          </div>
        </section>

        <section id="system" className="section-shell relative border-y border-white/10 bg-[#0A0E18] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="signal-rail signal-rail-system" aria-hidden="true"><span /><i /><b /></div>
          <div className="mx-auto max-w-[1440px]">
            <div className="section-intro">
              <p className="section-index">// 01 — THE PLATFORM</p>
              <div><h2 className="section-title">From raw inputs to confident moves—without leaving context behind.</h2><p className="section-copy">Luma keeps your inputs, agents, and approvals inside one calm intelligence layer built for high-stakes team decisions.</p></div>
            </div>
            <div className="mt-12 grid gap-3 md:grid-cols-12">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.eyebrow} className={`bento-card group ${feature.className}`} style={{ transitionDelay: `${index * 40}ms` }}>
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between gap-7">
                      <div className="flex items-start justify-between gap-5"><p className="eyebrow">{feature.eyebrow}</p><span className="bento-icon"><Icon className="size-5" /></span></div>
                      <div className="max-w-md"><h3 className="font-display text-3xl font-semibold leading-[0.98] tracking-[-0.05em] text-white md:text-4xl">{feature.title}</h3><p className="mt-4 max-w-sm text-sm leading-6 text-[#A9B2C5]">{feature.body}</p></div>
                    </div>
                    <div className="workflow-artifact relative z-10" aria-label={`${feature.artifact}: ${feature.artifactDetail}`}><div><p>{feature.artifact}</p><span>{feature.artifactDetail}</span></div><strong>{feature.artifactState}</strong></div>
                    <div className="bento-glow" aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="work" className="section-shell relative bg-[#070A12] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="signal-rail signal-rail-work" aria-hidden="true"><span /><i /><b /></div>
          <div className="mx-auto max-w-[1440px]">
            <div className="section-intro">
              <p className="section-index">// 02 — AI IN PRACTICE</p>
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><h2 className="section-title max-w-3xl">When the signal changes, every team needs the same clear next move.</h2></div><button onClick={() => notifyComingSoon("AI use cases")} className="text-link">Explore AI use cases <ChevronRight className="size-4" /></button></div>
            </div>
            <div className="masonry-grid mt-12">
              {caseStudies.map((study) => (
                <article key={study.number} className={`case-card ${study.aspect} group`}>
                  <img src={study.image} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  <div className="case-overlay" />
                  <div className="relative flex h-full min-h-[310px] flex-col justify-between p-5 md:p-6">
                    <div className="flex items-center justify-between"><span className="tag border-white/15 bg-black/20 text-white">{study.type}</span><span className="font-display text-sm font-semibold text-white/75">{study.number}</span></div>
                    <div><p className="project-phase">{study.phase}</p><p className="project-detail">{study.detail}</p><div className="mt-4 flex items-end justify-between gap-4"><h3 className="font-display text-3xl font-semibold leading-none tracking-[-0.055em] text-white md:text-4xl">{study.title}</h3><button className="case-arrow" aria-label={`View ${study.title}`} onClick={() => notifyComingSoon(study.title)}><ArrowUpRight className="size-4" /></button></div></div>
                  </div>
                </article>
              ))}
              <article className="case-card text-card">
                <div className="relative z-10 flex h-full min-h-[260px] flex-col justify-between p-6"><div><p className="eyebrow">YOUR INTELLIGENCE, MADE LEGIBLE</p><h3 className="mt-6 max-w-sm font-display text-3xl font-semibold leading-[0.95] tracking-[-0.055em] text-white">A calm system for knowing what changed, what matters, and why.</h3></div><button className="text-link w-fit" onClick={() => notifyComingSoon("Luma Intelligence")}>Talk to the team <ArrowRight className="size-4" /></button></div><div className="text-card-orbit" aria-hidden="true" /></article>
            </div>
          </div>
        </section>

        <section id="notes" className="section-shell relative overflow-hidden border-y border-white/10 bg-[#0B0F19] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="signal-rail signal-rail-notes" aria-hidden="true"><span /><i /><b /></div>
          <div className="notes-aura" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7"><p className="section-index">// 03 — THE PRINCIPLE</p><h2 className="mt-6 max-w-4xl font-display text-[clamp(3.1rem,6.8vw,6.6rem)] font-semibold leading-[0.88] tracking-[-0.075em] text-white">AI should make the reasoning more <span className="text-gradient">visible.</span></h2></div>
            <div className="glass-quote lg:col-span-5"><p className="font-display text-2xl leading-8 tracking-[-0.04em] text-white">“Luma does not choose your strategy. It carries the evidence, the open questions, and the prior decisions forward—so people can.”</p><div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs font-bold tracking-[0.13em] text-[#A8B2C8]">LUMA INTELLIGENCE / PRINCIPLE 01</span><span className="status-dot" /></div></div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#070A12] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="cta-line" aria-hidden="true"><span /><i /><b /></div>
          <div className="relative mx-auto grid max-w-[1240px] gap-8 md:grid-cols-12 md:items-end"><div className="md:col-span-8"><p className="section-index">// OPEN A CLEARER INTELLIGENCE LAYER</p><h2 className="mt-6 font-display text-[clamp(3.5rem,8vw,7.6rem)] font-bold leading-[0.83] tracking-[-0.085em] text-white">Bring every critical signal into <span className="text-gradient">focus.</span></h2><p className="mt-8 max-w-lg text-base leading-7 text-[#AAB4C6]">Start with the question that deserves a grounded answer. Keep the evidence close to the move it informs.</p><Button className="signal-button mt-10 h-13 rounded-full px-7 text-sm font-bold" onClick={() => notifyComingSoon("Your Luma Intelligence workspace")}>Request access <ArrowRight className="ml-2 size-4" /></Button></div><aside className="cta-status-card md:col-span-4"><p className="eyebrow">FIRST INTELLIGENCE BRIEF</p><div className="mt-10 flex items-center justify-between"><span className="status-dot" /><span className="font-display text-4xl font-semibold tracking-[-.08em] text-white">01</span></div><p className="mt-6 font-display text-xl font-semibold leading-6 text-white">Start with the question your team should not answer from memory alone.</p><div className="cta-status-line"><span /></div><p className="mt-3 text-[10px] font-bold tracking-[.14em] text-[#92A0B7]">STATUS / READY TO OPEN</p></aside></div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#05070D] px-5 py-8 md:px-8"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 text-xs text-[#7D879B] md:flex-row md:items-center"><div className="flex items-center gap-3"><img src="/manus-storage/luma-foundry-mark_e8a0bb3e.png" alt="" className="size-6" /><span>© 2026 Luma Intelligence. Concept template demonstration.</span></div><div className="flex gap-5"><a href="#top" className="hover:text-[#5AF4E5]">Top</a><a href="#system" className="hover:text-[#5AF4E5]">Platform</a><a href="#work" className="hover:text-[#5AF4E5]">Use cases</a></div></div></footer>
      </div>
    </>
  );
}
