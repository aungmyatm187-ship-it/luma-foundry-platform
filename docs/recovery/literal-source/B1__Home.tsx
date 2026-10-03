/* AI Marketer POV — intentionally text-free visual shell. */

function BlankLines({ className = "", count = 3 }: { className?: string; count?: number }) {
  return <div className={`blank-lines ${className}`}>{Array.from({ length: count }, (_, index) => <span key={index} />)}</div>;
}

function BlankDesk() {
  return (
    <div className="workspace-sheet" aria-hidden="true">
      <div className="workspace-top"><span className="timeline-tick" /><div className="flex gap-1"><i className="blank-dot" /><i className="blank-dot blue" /><i className="blank-dot coral" /></div></div>
      <div className="workspace-main">
        <aside className="workspace-sidebar"><span className="blank-mini-head" />{Array.from({ length: 5 }, (_, index) => <div className={`nav-mini ${index === 0 ? "active" : ""}`} key={index}><span className="mini-dot" /><span className="blank-nav-fill" /></div>)}</aside>
        <div className="workspace-canvas">
          <div className="metric-grid">{Array.from({ length: 2 }, (_, index) => <div className="metric-stamp" key={index}><span className="blank-mini-head" /><b className="blank-value" /></div>)}</div>
          <span className="blank-mini-head mb-3 block" />
          {["signal", "", "ink", "coral"].map((kind, index) => <div className="gantt-row" key={index}><span className="blank-row-label" /><div className="gantt-track"><span className={`gantt-bar ${kind}`} style={{ left: `${index * 12}%`, width: `${86 - index * 17}%` }} /></div></div>)}
        </div>
      </div>
    </div>
  );
}

function BlankCardGrid() {
  return <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <article className="proof-card" key={index}><span className="blank-icon" /><BlankLines count={2} className="mt-8" /><span className="blank-rule" /></article>)}</div>;
}

function BlankArticleRows() {
  return <div className="article-strip">{Array.from({ length: 6 }, (_, index) => <article className="article-item" key={index}><span className="blank-number" /><div><span className="blank-row-head" /><span className="blank-row-copy" /></div><span className="blank-link" /></article>)}</div>;
}

export default function Home() {
  return (
    <div className="site-shell min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0 paper-noise" />
      <header className="nav-wrap relative z-30"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3.5 md:px-8"><div className="brand-lockup"><img src="/manus-storage/ai-marketer-pov-logo_9d01ee8a.png" alt="" /><span className="blank-brand" /></div><nav className="hidden items-center gap-5 lg:flex" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <span className="blank-nav" key={index} />)}</nav><span className="blank-cta" /></div></header>

      <div className="page-layout relative z-10" id="top">
        <aside className="signal-rail hidden lg:flex" aria-hidden="true"><span className="blank-rail-marker" /><span className="rail-line" /><span className="blank-rail-word" /></aside>
        <main>
          <section className="mx-auto max-w-[1440px] px-5 pb-20 pt-12 md:px-8 md:pb-28 md:pt-20">
            <div className="hero-grid">
              <div className="hero-copy max-w-[40rem] self-center"><span className="blank-kicker" /><BlankLines className="blank-hero-title mt-6" count={3} /><BlankLines className="mt-7 max-w-[34rem]" count={3} /><div className="mt-8 flex gap-3"><span className="blank-primary-action" /><span className="blank-secondary-action" /></div><div className="mt-9 grid max-w-[31rem] grid-cols-3 gap-2 border-t border-[#10263f]/10 pt-5">{Array.from({ length: 3 }, (_, index) => <div key={index}><span className="blank-stat" /><span className="blank-stat-copy" /></div>)}</div></div>
              <div className="hero-art"><img className="hero-photo" src="/manus-storage/ai-marketer-pov-sme-hero_753cda07.jpg" alt="" /><div className="hero-photo-fade" /><span className="blank-photo-badge" /><BlankDesk /></div>
            </div>
          </section>

          <section className="tone-ink text-[#fffdf7]" aria-hidden="true"><div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 md:grid-cols-[auto_1fr_auto] md:items-center md:px-8"><span className="blank-round-icon" /><BlankLines className="blank-ink-lines max-w-3xl" count={2} /><span className="blank-ink-link" /></div></section>

          <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-8 md:py-28"><div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-end"><div><span className="blank-kicker" /><BlankLines className="blank-section-title mt-6" count={3} /><BlankLines className="mt-7 max-w-md" count={3} /><div className="mt-7 flex flex-wrap gap-2">{Array.from({ length: 4 }, (_, index) => <span className="blank-chip" key={index} />)}</div></div><div className="dashboard-frame"><div className="dashboard-top"><div><span className="blank-mini-head" /><span className="blank-desk-head" /></div><span className="blank-small-action" /></div><div className="workspace-content"><div className="blank-tabs">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div><div className="grid gap-4 sm:grid-cols-[1.05fr_.95fr]"><div className="blank-dashboard-card"><BlankLines count={3} /><span className="blank-small-pill" /></div><div className="blank-dashboard-card ink"><span className="blank-mini-head" /><span className="blank-big-value" /><span className="blank-progress" /></div></div></div></div></div></section>

          <section className="split-rule mx-auto max-w-[1440px] px-5 py-20 md:px-8 md:py-28"><div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><div className="orbit-image"><img src="/manus-storage/ai-marketer-pov-signal-orbit_039b4794.jpg" alt="" /><div className="blank-orbit-overlay"><span /><span /></div></div><div><span className="blank-kicker" /><BlankLines className="blank-section-title mt-6" count={3} /><BlankLines className="mt-7 max-w-xl" count={3} /><div className="mt-7 grid grid-cols-3 gap-3">{Array.from({ length: 3 }, (_, index) => <div className="blank-mini-card" key={index}><span /><span /><span /></div>)}</div></div></div></section>

          <section className="tone-muted px-5 py-20 md:px-8 md:py-28"><div className="mx-auto max-w-[1440px]"><div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><span className="blank-kicker" /><BlankLines className="blank-section-title mt-5" count={3} /></div><BlankLines className="max-w-sm" count={3} /></div><BlankCardGrid /></div></section>

          <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-8 md:py-28"><div className="grid gap-10 lg:grid-cols-[.74fr_1.26fr]"><div><span className="blank-kicker" /><BlankLines className="blank-section-title mt-6" count={3} /><BlankLines className="mt-7 max-w-md" count={3} /><div className="mt-7 flex gap-2">{Array.from({ length: 3 }, (_, index) => <span className="blank-note-dot" key={index} />)}</div></div><div className="blank-note-card"><div className="flex items-start justify-between"><span className="blank-note-number" /><span className="blank-chip" /></div><BlankLines className="mt-10" count={2} /><BlankLines className="mt-8 max-w-2xl" count={3} /><div className="mt-10 flex items-center justify-between border-t border-[#10263f]/10 pt-5"><span className="blank-mini-head" /><span className="blank-small-action" /></div></div></div></section>

          <section className="tone-paper px-5 py-20 md:px-8 md:py-28"><div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="blank-kicker" /><BlankLines className="blank-section-title mt-6" count={3} /><BlankLines className="mt-7 max-w-sm" count={3} /><span className="blank-source-image" /></div><BlankArticleRows /></div></section>

          <section className="tone-ink px-5 py-20 text-[#fffdf7] md:px-8 md:py-24"><div className="mx-auto grid max-w-[1440px] gap-9 lg:grid-cols-[1fr_auto] lg:items-end"><div><span className="blank-ink-kicker" /><BlankLines className="blank-final-title mt-6" count={3} /><BlankLines className="blank-ink-lines mt-7 max-w-xl" count={3} /></div><div className="flex gap-3"><span className="blank-light-action" /><span className="blank-outline-action" /></div></div></section>
        </main>
      </div>

      <footer className="relative z-10 bg-[#10263f] px-5 pb-8 md:px-8"><div className="mx-auto flex max-w-[1440px] flex-col gap-5 border-t border-white/12 pt-7 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><img src="/manus-storage/ai-marketer-pov-logo_9d01ee8a.png" alt="" className="h-6 w-6" /><span className="blank-footer-brand" /></div><div className="flex gap-4">{Array.from({ length: 4 }, (_, index) => <span className="blank-footer-link" key={index} />)}</div></div></footer>
    </div>
  );
}
