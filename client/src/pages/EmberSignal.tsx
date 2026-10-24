/**
 * Ember Signal design reminder: nocturnal editorial performance design with ember-orange
 * campaign pulses, acid-lime verification states, glass evidence artifacts, and an asymmetric conversion wall.
 */
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  Flame,
  Menu,
  MoveUpRight,
  Orbit,
  Radar,
  Sparkles,
  WandSparkles,
  X,
  Zap,
  LoaderCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const capabilities = [
  {
    index: "01",
    label: "SOURCE INTELLIGENCE",
    title: "Turn market noise into a direction worth backing.",
    body: "Ember reads the live language around your category, then shows the tension your next campaign can actually own.",
    artifact: "Signal field / 42 live threads",
    artifactDetail: "Audience language → emerging tension → point of view",
    state: "VERIFIED",
    icon: Radar,
    size: "md:col-span-7",
  },
  {
    index: "02",
    label: "BRIEF ENGINE",
    title: "Make the strategy feel inevitable.",
    body: "Shape a living creative brief that makes the audience, promise, proof, and pressure point impossible to lose.",
    artifact: "Brief / Narrative A",
    artifactDetail: "Promise held · evidence linked · room aligned",
    state: "READY",
    icon: WandSparkles,
    size: "md:col-span-5",
  },
  {
    index: "03",
    label: "MOMENTUM MAP",
    title: "Know when the market moved before the room does.",
    body: "Track campaign pulse across channels and surface the adjustment with the best chance of changing the outcome.",
    artifact: "Pulse / opportunity window",
    artifactDetail: "Channel shift → audience reaction → action cue",
    state: "LIVE",
    icon: Orbit,
    size: "md:col-span-5",
  },
  {
    index: "04",
    label: "CAMPAIGN MEMORY",
    title: "Keep every good decision close to its proof.",
    body: "A lightweight record of what your team believed, changed, and learned—ready when the next brief begins.",
    artifact: "Memory / spring launch",
    artifactDetail: "Decision owner · change log · evidence trail",
    state: "PERSISTENT",
    icon: CircleDot,
    size: "md:col-span-7",
  },
];

const campaignStories = [
  {
    number: "01",
    title: "Voice of customer",
    category: "Market listening",
    image: "/manus-storage/luma-intelligence-synthesis_4cb322c5.png",
    detail: "Find the phrases your audience keeps repeating before they become the category cliché.",
    layout: "portrait",
  },
  {
    number: "02",
    title: "Narrative trajectory",
    category: "Campaign brief",
    image: "/manus-storage/luma-intelligence-agents_352e3e15.png",
    detail: "Carry a point of view from audience signal to the creative room without dropping the reason it matters.",
    layout: "landscape",
  },
  {
    number: "03",
    title: "Channel operating model",
    category: "Live optimization",
    image: "/manus-storage/luma-intelligence-memory_62a5a77a.png",
    detail: "One changing market, one shared call, every channel moving with intent.",
    layout: "tall",
  },
];

type BriefChannel = "email" | "social" | "web" | "events" | "paid-media";

type BriefForm = {
  campaignName: string;
  audience: string;
  marketSignals: string;
  desiredOutcome: string;
  channels: BriefChannel[];
};

const initialBriefForm: BriefForm = {
  campaignName: "Northern Light",
  audience: "Independent teams choosing a sharper point of view",
  marketSignals: "People want proof they can act on, not another broad promise.",
  desiredOutcome: "Create a campaign brief that earns a clear next decision.",
  channels: ["email", "social"],
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBriefBuilder, setShowBriefBuilder] = useState(false);
  const [briefForm, setBriefForm] = useState<BriefForm>(initialBriefForm);
  const buildBrief = trpc.emberSignal.buildCampaignBrief.useMutation();
  const localEvidence = trpc.emberSignal.getLocalEvidence.useQuery(undefined, { enabled: showBriefBuilder, retry: false });
  const evidenceMessage = localEvidence.data && "message" in localEvidence.data
    ? localEvidence.data.message
    : "No verified evidence is available yet.";
  const evidenceSourceLabel = localEvidence.data?.source === "render" ? "RENDER EVIDENCE" : "LOCAL EVIDENCE";
  const evidenceSourceDescription = localEvidence.data?.source === "render"
    ? "Canonical Render operational source; release identity is recorded in the API response."
    : "Bounded local fallback. This panel does not prove commercial clearance.";

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sections = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (reduceMotion) {
      sections.forEach((section) => section.classList.add("is-revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-revealed")),
      { threshold: 0.1 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const notify = (label: string) => {
    toast(`${label} is ready for the next build step.`, {
      description: "This demo shows the strategic surface, interaction model, and conversion pattern.",
    });
  };

  const updateBriefField = (field: Exclude<keyof BriefForm, "channels">, value: string) => {
    setBriefForm((current) => ({ ...current, [field]: value }));
  };

  const toggleChannel = (channel: BriefChannel) => {
    setBriefForm((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  };

  const openBriefBuilder = () => {
    setShowBriefBuilder(true);
    buildBrief.reset();
  };

  const submitBrief = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    buildBrief.mutate(briefForm);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#07090E] text-[#F4F0E8] selection:bg-[#D5FF5A] selection:text-[#10120D]">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="site-header">
        <nav aria-label="Primary navigation" className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="brand-mark group" aria-label="Ember Signal home">
            <span className="ember-mark" aria-hidden="true"><i /><b /></span>
            <span className="brand-type"><strong>EMBER</strong><i> / </i>SIGNAL</span>
          </a>

          <div className="hidden items-center gap-7 text-sm text-[#C4C2BA] md:flex">
            <a className="nav-link" href="#engine">The engine</a>
            <a className="nav-link" href="#stories">Campaigns</a>
            <a className="nav-link" href="#method">Method</a>
          </div>

          <div className="hidden md:block">
            <Button type="button" className="ember-button h-10 rounded-full px-5 text-xs font-bold uppercase tracking-[0.12em]" onClick={openBriefBuilder}>Build your campaign <ArrowUpRight className="ml-1 size-3.5" /></Button>
          </div>

          <button type="button" className="mobile-menu-button md:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0D1015]/95 px-5 py-5 backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-[1480px] flex-col gap-1">
              {[["The engine", "engine"], ["Campaigns", "stories"], ["Method", "method"]].map(([label, id]) => (
                <button type="button" key={id} className="mobile-nav-item" onClick={() => { scrollToSection(id); setMenuOpen(false); }}>
                  {label}<ArrowRight className="size-4 text-[#D5FF5A]" />
                </button>
              ))}
              <Button type="button" className="ember-button mt-2 rounded-xl" onClick={openBriefBuilder}>Build your campaign</Button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        <section id="top" className="ember-hero relative isolate overflow-hidden px-5 pb-14 pt-11 md:px-8 md:pb-24 md:pt-20">
          <div className="ember-grid" aria-hidden="true" />
          <div className="ember-aura ember-aura-one" aria-hidden="true" />
          <div className="ember-aura ember-aura-two" aria-hidden="true" />
          <div className="mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-12 lg:items-end">
            <div className="relative z-10 lg:col-span-6 lg:pb-5">
              <div className="reveal-item mb-7 flex items-center gap-3 text-[10px] font-bold tracking-[0.2em] text-[#AAA9A2]" style={{ animationDelay: "90ms" }}><span className="ember-line" />AI MARKETING INTELLIGENCE / 2026</div>
              <h1 className="reveal-item max-w-[800px] font-editorial text-[clamp(4.1rem,8.8vw,8.7rem)] font-semibold leading-[0.83] tracking-[-0.07em] text-[#F5F0E7]" style={{ animationDelay: "150ms" }}>
                Stop feeding the funnel. <span className="ember-text">Start reading the signal.</span>
              </h1>
              <p className="reveal-item mt-7 max-w-xl text-base leading-7 text-[#C0BFB8] md:text-lg" style={{ animationDelay: "230ms" }}>
                Ember Signal connects audience language, campaign evidence, and market movement into one sharp point of view your team can act on before the moment passes.
              </p>
              <div className="reveal-item mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "310ms" }}>
                <Button type="button" className="ember-button group h-12 rounded-full px-6 text-sm font-bold" onClick={openBriefBuilder}>Build a live campaign brief <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1" /></Button>
                <button type="button" className="ghost-button h-12 rounded-full px-5 text-sm font-semibold" onClick={() => notify("Ember Signal demo")}>See the signal map <MoveUpRight className="size-4 text-[#D5FF5A]" /></button>
              </div>
              <div className="reveal-item mt-12 flex items-center gap-4 text-xs text-[#898983]" style={{ animationDelay: "390ms" }}>
                <div className="flex items-center gap-1.5"><span className="pulse-dot" /><span className="font-mono text-[10px] tracking-[.14em]">LIVE MARKET PULSE</span></div><span className="hidden h-4 w-px bg-white/15 sm:block" /><span>For teams that need the room to move with one reason.</span>
              </div>
            </div>

            <div className="relative z-10 lg:col-span-6" aria-label="A campaign intelligence workspace preview">
              <div className="campaign-workspace reveal-item" style={{ animationDelay: "230ms" }}>
                <img src="/manus-storage/luma-intelligence-hero_82135acf.png" alt="Abstract intelligence layers converging into a campaign recommendation" className="campaign-image" />
                <div className="campaign-scrim" />
                <div className="relative flex min-h-[430px] flex-col justify-between p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4"><div className="glass-label ember-glass-label"><span className="pulse-dot" />Campaign / NORTHERN LIGHT</div><button type="button" className="glass-icon" aria-label="Open campaign controls" onClick={() => notify("Campaign controls")}><MoveUpRight className="size-4" /></button></div>
                  <div className="relative mx-auto flex size-32 items-center justify-center sm:size-40" aria-hidden="true"><div className="campaign-orbit orbit-one" /><div className="campaign-orbit orbit-two" /><div className="campaign-core"><Flame className="size-6" /></div><i className="orbital-node node-a" /><i className="orbital-node node-b" /><i className="orbital-node node-c" /></div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><article className="campaign-note"><div className="mb-5 flex items-center justify-between text-[10px] font-bold tracking-[0.15em] text-[#A4A39B]"><span>NEXT CALL</span><span className="text-[#D5FF5A]">09:40</span></div><p className="font-editorial text-[1.35rem] font-semibold leading-6 text-white">Make the community proof the campaign’s lead line.</p><div className="mt-5 flex gap-2"><span className="tag ember-tag">EVIDENCE</span><span className="tag ember-tag">ALIGNED</span></div></article><div className="campaign-score"><span className="text-[10px] font-bold tracking-[0.14em] text-[#AAA9A2]">SIGNAL</span><strong className="font-editorial text-4xl tracking-[-0.08em] text-white">91</strong><div className="score-track"><span /></div></div></div>
                </div>
              </div>
              <div className="campaign-float hidden md:block"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[#D5FF5A] text-[#151708]"><Check className="size-4" /></span><div><p className="text-xs font-bold text-white">New audience tension found</p><p className="mt-0.5 text-[11px] text-[#A6A6A0]">7 evidence threads converged</p></div></div></div>
            </div>
          </div>
          <div className="mx-auto mt-16 flex max-w-[1480px] justify-between border-t border-white/10 pt-5 text-[10px] font-bold tracking-[0.16em] text-[#7E7F79]"><span>SCROLL FOR THE ENGINE</span><ArrowDownRight className="size-4 text-[#D5FF5A]" /></div>
        </section>

        <section id="engine" className="section-shell relative border-y border-white/10 bg-[#0C0E13] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="ember-rail ember-rail-engine" aria-hidden="true"><span /><i /><b /></div>
          <div className="mx-auto max-w-[1480px]"><div className="section-intro"><p className="section-index">// 01 — THE ENGINE</p><div><h2 className="section-title">One moving market. One clear place to <em>decide.</em></h2><p className="section-copy">Ember works like the best strategist in the room: it keeps the live evidence close to the decision, then makes the next move visible.</p></div></div>
            <div className="mt-12 grid gap-3 md:grid-cols-12">{capabilities.map((capability, index) => { const Icon = capability.icon; return <article key={capability.index} className={`ember-bento group ${capability.size}`} style={{ transitionDelay: `${index * 40}ms` }}><div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between gap-7"><div className="flex items-start justify-between gap-5"><p className="eyebrow">{capability.index} / {capability.label}</p><span className="ember-icon"><Icon className="size-5" /></span></div><div className="max-w-md"><h3 className="font-editorial text-3xl font-semibold leading-[0.98] tracking-[-0.045em] text-white md:text-4xl">{capability.title}</h3><p className="mt-4 max-w-sm text-sm leading-6 text-[#B3B2AB]">{capability.body}</p></div></div><div className="campaign-artifact relative z-10" aria-label={`${capability.artifact}: ${capability.artifactDetail}`}><div><p>{capability.artifact}</p><span>{capability.artifactDetail}</span></div><strong>{capability.state}</strong></div><div className="ember-glow" aria-hidden="true" /></article>; })}</div>
          </div>
        </section>

        <section id="stories" className="section-shell relative bg-[#07090E] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="ember-rail ember-rail-stories" aria-hidden="true"><span /><i /><b /></div>
          <div className="mx-auto max-w-[1480px]"><div className="section-intro"><p className="section-index">// 02 — CAMPAIGN SURFACES</p><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><h2 className="section-title max-w-3xl">Every campaign gets stronger when the proof stays <em>in view.</em></h2><button type="button" onClick={() => notify("All campaign surfaces")} className="text-link">Explore the system <ChevronRight className="size-4" /></button></div></div>
            <div className="ember-masonry mt-12">{campaignStories.map((story) => <article key={story.number} className={`campaign-card ${story.layout} group`}><img src={story.image} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]" /><div className="campaign-overlay" /><div className="relative flex h-full min-h-[310px] flex-col justify-between p-5 md:p-6"><div className="flex items-center justify-between"><span className="tag ember-tag border-white/15 bg-black/25 text-white">{story.category}</span><span className="font-editorial text-sm font-semibold text-white/75">{story.number}</span></div><div><p className="project-phase">OPERATING SURFACE</p><p className="project-detail">{story.detail}</p><div className="mt-4 flex items-end justify-between gap-4"><h3 className="font-editorial text-3xl font-semibold leading-none tracking-[-0.055em] text-white md:text-4xl">{story.title}</h3><button type="button" className="campaign-arrow" aria-label={`Open ${story.title}`} onClick={() => notify(story.title)}><ArrowUpRight className="size-4" /></button></div></div></div></article>)}
              <article className="campaign-card manifesto-card"><div className="relative z-10 flex h-full min-h-[260px] flex-col justify-between p-6"><div><p className="eyebrow">THE POV DOES THE WORK</p><h3 className="mt-6 max-w-sm font-editorial text-4xl font-semibold leading-[0.92] tracking-[-0.055em] text-white">The market does not need more messages. It needs a reason to <em>move.</em></h3></div><button type="button" className="text-link w-fit" onClick={() => notify("Ember Signal method")}>See the method <ArrowRight className="size-4" /></button></div><div className="manifesto-orbit" aria-hidden="true" /></article>
            </div>
          </div>
        </section>

        <section id="method" className="section-shell relative overflow-hidden border-y border-white/10 bg-[#11100E] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="method-aura" aria-hidden="true" /><div className="ember-rail ember-rail-method" aria-hidden="true"><span /><i /><b /></div>
          <div className="relative mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-12 lg:items-end"><div className="lg:col-span-7"><p className="section-index">// 03 — THE METHOD</p><h2 className="mt-6 max-w-4xl font-editorial text-[clamp(3.5rem,7vw,7rem)] font-semibold leading-[0.84] tracking-[-0.075em] text-white">The strongest creative answer is usually hiding in the <span className="ember-text">evidence.</span></h2></div><div className="method-quote lg:col-span-5"><p className="font-editorial text-2xl leading-8 tracking-[-0.04em] text-white">“A market signal is only valuable when it changes the room’s next decision. Everything else is just activity.”</p><div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs font-bold tracking-[0.13em] text-[#A8A69D]">EMBER SIGNAL / PRINCIPLE 01</span><span className="pulse-dot" /></div></div></div>
        </section>

        <section className="relative overflow-hidden bg-[#07090E] px-5 py-20 md:px-8 md:py-28" data-reveal>
          <div className="cta-pulse" aria-hidden="true"><span /><i /><b /></div>
          <div className="relative mx-auto grid max-w-[1280px] gap-8 md:grid-cols-12 md:items-start">
            <div className="md:col-span-8">
              <p className="section-index">// START WITH THE REAL TENSION</p>
              <h2 className="mt-6 font-editorial text-[clamp(3.8rem,8vw,8.2rem)] font-semibold leading-[0.8] tracking-[-0.085em] text-white">Build a campaign the room can <span className="ember-text">move on.</span></h2>
              <p className="mt-8 max-w-lg text-base leading-7 text-[#B2B0A9]">Give Ember the brief, the market, and the messy evidence. Keep the next good call close to the people who need to make it.</p>
              <Button type="button" className="ember-button mt-10 h-13 rounded-full px-7 text-sm font-bold" onClick={openBriefBuilder}>Build your campaign <ArrowRight className="ml-2 size-4" /></Button>

              {showBriefBuilder && (
                <form onSubmit={submitBrief} className="mt-8 rounded-[1.75rem] border border-[#D5FF5A]/25 bg-[#11150F]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,.3)] backdrop-blur-xl md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow text-[#D5FF5A]">LIVE BRIEF BUILDER / AUTHENTICATED</p>
                      <h3 className="mt-3 font-editorial text-3xl font-semibold leading-none tracking-[-.05em] text-white">Name the signal.</h3>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-[#B3B2AB]">Give Ember the evidence you already have. It will return a concise brief without inventing proof.</p>
                    </div>
                    <button type="button" onClick={() => setShowBriefBuilder(false)} className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-[#B3B2AB] transition duration-300 hover:border-[#D5FF5A]/60 hover:text-white" aria-label="Close campaign brief builder"><X className="size-4" /></button>
                  </div>

                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#AAA9A2]">Campaign name<input required value={briefForm.campaignName} onChange={(event) => updateBriefField("campaignName", event.target.value)} className="h-11 rounded-xl border border-white/15 bg-black/20 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none transition duration-300 placeholder:text-[#777870] focus:border-[#D5FF5A]" placeholder="Northern Light" /></label>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#AAA9A2]">Desired outcome<input required value={briefForm.desiredOutcome} onChange={(event) => updateBriefField("desiredOutcome", event.target.value)} className="h-11 rounded-xl border border-white/15 bg-black/20 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none transition duration-300 placeholder:text-[#777870] focus:border-[#D5FF5A]" placeholder="Earn the next decision" /></label>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#AAA9A2] sm:col-span-2">Audience<textarea required value={briefForm.audience} onChange={(event) => updateBriefField("audience", event.target.value)} className="min-h-20 resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none transition duration-300 placeholder:text-[#777870] focus:border-[#D5FF5A]" placeholder="Who needs to move?" /></label>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#AAA9A2] sm:col-span-2">Market evidence<textarea required value={briefForm.marketSignals} onChange={(event) => updateBriefField("marketSignals", event.target.value)} className="min-h-24 resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none transition duration-300 placeholder:text-[#777870] focus:border-[#D5FF5A]" placeholder="What are people saying, doing, or resisting?" /></label>
                  </div>

                  <fieldset className="mt-5">
                    <legend className="text-xs font-bold uppercase tracking-[.12em] text-[#AAA9A2]">Working channels</legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["email", "social", "web", "events", "paid-media"].map((channel) => <button key={channel} type="button" onClick={() => toggleChannel(channel as BriefChannel)} className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[.1em] transition duration-300 ${briefForm.channels.includes(channel as BriefChannel) ? "border-[#D5FF5A] bg-[#D5FF5A] text-[#10120D]" : "border-white/15 text-[#AAA9A2] hover:border-[#D5FF5A]/60 hover:text-white"}`}>{channel.replace("-", " ")}</button>)}
                    </div>
                  </fieldset>

                  <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-md text-xs leading-5 text-[#85867F]">This is a protected server-side action. Your brief is not stored by this page.</p>
                    <Button type="submit" disabled={buildBrief.isPending || briefForm.channels.length === 0} className="ember-button h-11 rounded-full px-5 text-sm font-bold disabled:cursor-wait disabled:opacity-60">{buildBrief.isPending ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Reading the signal</> : "Generate the brief"}</Button>
                  </div>

                  {buildBrief.error && <p role="alert" className="mt-5 rounded-xl border border-[#FF8A7A]/30 bg-[#3A1716]/40 p-3 text-sm leading-6 text-[#FFB5AA]">{buildBrief.error.message}</p>}
                  {buildBrief.data?.brief && <article className="mt-7 rounded-2xl border border-white/10 bg-black/25 p-5 md:p-6" aria-live="polite"><div className="flex items-center justify-between gap-4"><p className="eyebrow text-[#D5FF5A]">EMBER READOUT / {buildBrief.data.model}</p>{buildBrief.data.usage && <span className="font-mono text-[10px] tracking-[.1em] text-[#85867F]">{buildBrief.data.usage.total_tokens} TOKENS</span>}</div><h4 className="mt-5 font-editorial text-2xl font-semibold leading-tight text-white">{buildBrief.data.brief.campaignThesis}</h4><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="eyebrow">CORE TENSION</p><p className="mt-2 text-sm leading-6 text-[#C0BFB8]">{buildBrief.data.brief.coreTension}</p></div><div><p className="eyebrow">RECOMMENDED MOVE</p><p className="mt-2 text-sm leading-6 text-[#C0BFB8]">{buildBrief.data.brief.recommendedMove}</p></div></div><div className="mt-5 border-t border-white/10 pt-4"><p className="eyebrow">PROOF TO KEEP CLOSE</p><ul className="mt-2 grid gap-2 text-sm leading-6 text-[#C0BFB8]">{buildBrief.data.brief.proofPoints.map((point) => <li key={point} className="flex gap-2"><span className="text-[#D5FF5A]">↗</span>{point}</li>)}</ul><p className="mt-5 text-xs leading-5 text-[#85867F]">Next question: {buildBrief.data.brief.nextQuestion}</p></div></article>}
                </form>
              )}
            </div>
            <aside className="campaign-status-card md:col-span-4"><p className="eyebrow">FIRST CAMPAIGN SIGNAL</p><div className="mt-10 flex items-center justify-between"><span className="pulse-dot" /><span className="font-editorial text-4xl font-semibold tracking-[-.08em] text-white">01</span></div><p className="mt-6 font-editorial text-2xl font-semibold leading-6 text-white">Start with the audience truth your team has not named yet.</p><div className="status-line"><span /></div><p className="mt-3 text-[10px] font-bold tracking-[.14em] text-[#929089]">STATUS / READY TO READ</p>

              <div className="mt-10 border-t border-white/10 pt-6" aria-live="polite">
                <div className="flex items-center justify-between gap-3"><p className="eyebrow text-[#D5FF5A]">{evidenceSourceLabel}</p><button type="button" onClick={() => localEvidence.refetch()} className="text-[10px] font-bold tracking-[.12em] text-[#AAA9A2] transition duration-300 hover:text-white" disabled={localEvidence.isFetching}>{localEvidence.isFetching ? "READING" : "REFRESH"}</button></div>
                {!showBriefBuilder && <p className="mt-3 text-xs leading-5 text-[#AAA9A2]">Open the protected brief builder to read evidence.</p>}
                {showBriefBuilder && localEvidence.isLoading && <p className="mt-3 text-xs leading-5 text-[#AAA9A2]">Reading the canonical evidence source…</p>}
                {showBriefBuilder && localEvidence.error && <p role="alert" className="mt-3 text-xs leading-5 text-[#FFB5AA]">Sign in to read protected evidence.</p>}
                {showBriefBuilder && localEvidence.data?.status !== "ready" && !localEvidence.isLoading && !localEvidence.error && <p className="mt-3 text-xs leading-5 text-[#AAA9A2]">{evidenceMessage}</p>}
                {localEvidence.data?.status === "ready" && <div className="mt-4 grid gap-3">{localEvidence.data.records.slice(0, 3).map((record) => <article key={record.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-bold text-white">{record.title}</p><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[#D5FF5A]">{record.status}</span></div><p className="mt-2 text-xs leading-5 text-[#AAA9A2]">{record.summary}</p><p className="mt-2 text-[9px] font-bold uppercase tracking-[.11em] text-[#777870]">{record.source} · {record.observedAt}</p></article>)}</div>}
                {localEvidence.data?.status === "ready" && localEvidence.data.records.length > 3 && <p className="mt-3 text-[10px] font-bold tracking-[.1em] text-[#777870]">+ {localEvidence.data.records.length - 3} MORE RECORDS</p>}
                {localEvidence.data?.status === "ready" && <p className="mt-4 text-[10px] leading-4 text-[#777870]">Source: {evidenceSourceDescription}</p>}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050609] px-5 py-8 md:px-8"><div className="mx-auto flex max-w-[1480px] flex-col justify-between gap-6 text-xs text-[#7C7B75] md:flex-row md:items-center"><div className="flex items-center gap-3"><span className="ember-mark ember-mark-small" aria-hidden="true"><i /><b /></span><span>© 2026 Ember Signal. Original AI marketing concept.</span></div><div className="flex gap-5"><a href="#top" className="hover:text-[#D5FF5A]">Top</a><a href="#engine" className="hover:text-[#D5FF5A]">Engine</a><a href="#stories" className="hover:text-[#D5FF5A]">Campaigns</a></div></div></footer>
    </div>
  );
}
