import { ArrowUpRight, HeartPulse, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBatchReveal } from "@/hooks/useBatchReveal";
import styles from "./batch-02.css?raw";

const pathways = [
  ["01", "See the next moment", "A shared view for the conversations, needs, and capacity that shape today’s care."],
  ["02", "Route with context", "Bring the right person into the decision with the history and judgement they need."],
  ["03", "Keep care moving", "Turn a plan into a calm, observable handoff without another administrative loop."],
];

export default function StillaCareSystems() {
  const [menu, setMenu] = useState(false);
  useBatchReveal();
  const contact = () => toast("Consultation request noted", { description: "Stilla Care Systems is presented as a premium product concept." });
  return <><style>{styles}</style><div className="stilla-page" id="stilla-top">
    <a className="b2-skip stilla-skip" href="#stilla-main">Skip to content</a>
    <header className="stilla-nav"><a href="#stilla-top" className="stilla-brand"><span>STILLA</span><i>care systems</i></a><nav><a href="#path">Pathway</a><a href="#practice">Practice</a><a href="#consult">Consult</a></nav><button onClick={contact}>Arrange a consultation <ArrowUpRight /></button><button aria-label="Toggle menu" className="stilla-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    {menu && <nav className="stilla-mobile"><a href="#path" onClick={() => setMenu(false)}>Pathway</a><a href="#practice" onClick={() => setMenu(false)}>Practice</a><button onClick={contact}>Arrange a consultation</button></nav>}
    <main id="stilla-main"><section className="stilla-hero"><div className="stilla-intro"><p className="stilla-eyebrow"><span />CARE OPERATIONS / MADE CLEARER</p><h1>More room<br />for <em>care.</em></h1><p>Stilla helps care teams coordinate the moments that matter—with the calm, continuity, and clinical judgement every person deserves.</p><div className="stilla-actions"><button onClick={contact}>See the care pathway <ArrowUpRight /></button><a href="#path">Explore the system <span>↓</span></a></div><aside><HeartPulse /><span>BUILT FOR THE WORK<br />BETWEEN VISITS</span></aside></div><figure className="stilla-hero-art"><img src="/manus-storage/stilla-care-hero_1ac443b2.png" alt="Abstract eucalyptus care pathway flowing through a calm clinical setting" /><figcaption>COORDINATION WITH A HUMAN CENTRE <Sparkles /></figcaption></figure></section>
    <section id="path" className="stilla-path"><div className="stilla-section-title" data-batch-reveal><p>A PATHWAY, NOT A QUEUE</p><h2>Every handoff can<br />feel <em>considered.</em></h2></div><div className="stilla-river"><div className="stilla-river-line" aria-hidden="true" />{pathways.map(([number, title, copy]) => <article key={number} data-batch-reveal><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section id="practice" className="stilla-practice"><div data-batch-reveal><p>THE PRACTICE LAYER</p><h2>Useful intelligence.<br /><em>Accountable care.</em></h2></div><div className="stilla-practice-grid" data-batch-reveal><article><ShieldCheck /><h3>Privacy in practice</h3><p>Operational controls that respect the sensitivity of every care interaction.</p></article><article><span className="stilla-pulse">•••</span><h3>Clarity for teams</h3><p>One working view of who needs what, and what should happen next.</p></article><article><span className="stilla-note">CARE NOTE / 04</span><h3>Implementation that listens</h3><p>Map real care rhythms before introducing a new one.</p></article></div></section>
    <section id="consult" className="stilla-close" data-batch-reveal><p>THE QUIETER WAY FORWARD</p><h2>Build the capacity<br />to <em>be present.</em></h2><button onClick={contact}>Arrange a care operations consultation <ArrowUpRight /></button></section></main>
    <footer className="stilla-footer"><span>STILLA CARE SYSTEMS / HUMAN-CENTRED OPERATIONS</span><a href="#stilla-top">RETURN TO CALM ↑</a></footer>
  </div></>;
}
