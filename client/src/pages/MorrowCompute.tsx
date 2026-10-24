import { ArrowDownRight, ArrowUpRight, Box, Cpu, Menu, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBatchReveal } from "@/hooks/useBatchReveal";
import styles from "./batch-02.css?raw";
import overrides from "./morrow-compute-overrides.css?raw";

const specs = [["THERMAL", "Silent envelope engineered for deployment where concentration matters."], ["LATENCY", "Bring inference closer to the decision, without an elaborate detour."], ["CONTROL", "Operate a fleet with precise visibility across every physical environment."]];

export default function MorrowCompute() {
  const [menu, setMenu] = useState(false);
  useBatchReveal();
  const contact = () => toast("Distributor enquiry prepared", { description: "Morrow Compute is staged as a premium product concept." });
  return <><style>{styles}{overrides}</style><div className="morrow-page" id="morrow-top"><a className="b2-skip morrow-skip" href="#morrow-main">Skip to content</a>
    <header className="morrow-nav"><a href="#morrow-top" className="morrow-wordmark">MORROW<span>®</span></a><nav><a href="#hardware">Hardware</a><a href="#spec">Specification</a><a href="#kit">Developer kit</a></nav><button className="morrow-nav-cta" onClick={contact}>Distributor inquiry <ArrowUpRight /></button><button aria-label="Toggle menu" className="morrow-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    {menu && <nav className="morrow-mobile"><a href="#hardware" onClick={() => setMenu(false)}>Hardware</a><a href="#spec" onClick={() => setMenu(false)}>Specification</a><button onClick={contact}>Distributor inquiry</button></nav>}
    <main id="morrow-main"><section className="morrow-hero"><div className="morrow-index">MC–01<br /><span>EDGE / INTELLIGENCE</span></div><div className="morrow-hero-copy"><p>COMPUTE, PLACED WITH INTENT</p><h1>Closer<br />to the <em>world.</em></h1><div className="morrow-bottom"><p>Purpose-built edge AI hardware for the environments where decisions cannot wait for a distant cloud.</p><button onClick={contact}>Explore Morrow Core <ArrowDownRight /></button></div></div><figure><img src="/manus-storage/morrow-compute-hero_c6e8b9b7.png" alt="Precision-machined titanium edge computing module" /><figcaption><i />MORROW CORE / REV 01</figcaption></figure></section>
    <section id="hardware" className="morrow-manifest" data-batch-reveal><p>NO EXCESS, JUST CAPABILITY.</p><div><h2>Engineered<br />matter for the<br /><em>edge.</em></h2><article><Box /><p>Designed as a calm physical object, then tested against the variables that are anything but.</p></article></div></section>
    <section id="spec" className="morrow-spec"><div className="morrow-spec-intro" data-batch-reveal><p>01 / SPECIFICATION LOG</p><h2>A system that explains<br />itself <em>precisely.</em></h2></div><div className="morrow-spec-list">{specs.map(([label, copy], index) => <article key={label} data-batch-reveal><span>0{index + 1}</span><h3>{label}</h3><p>{copy}</p><Cpu /></article>)}</div></section>
    <section id="kit" className="morrow-close"><div><p>DEVELOPER KIT / AVAILABLE NOW</p><h2>Make the<br />next site <em>intelligent.</em></h2></div><button onClick={contact}>Request a distributor briefing <ArrowUpRight /></button></section></main>
    <footer className="morrow-footer"><span>MORROW COMPUTE / ENGINEERED FOR DEPLOYMENT</span><a href="#morrow-top">TOP ↑</a></footer>
  </div></>;
}
