/** Axiom Grid design reminder: liquid-metal infrastructure editorialism; cobalt energy and technical mono only mark live system states. */
import { ArrowUpRight, Boxes, Database, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBatchReveal } from "@/hooks/useBatchReveal";
import styles from "./axiom-grid.css?raw";

const planes = [
  ["01", "Compute fabric", "Place demand where the hardware is quiet, available, and ready."],
  ["02", "Policy at the edge", "Keep data intent, routing rules, and regional control in the same frame."],
  ["03", "Capacity without theatre", "See what is carrying work now before you move the next workload."],
];

export default function AxiomGrid() {
  const [menu, setMenu] = useState(false);
  useBatchReveal();
  const notify = () => toast("Access brief requested", { description: "Axiom Grid is staged as a premium product concept." });
  const openAccess = () => {
    document.getElementById("access")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return <><style>{styles}</style><div className="axiom-page" id="top">
    <a className="axiom-skip" href="#axiom-main">Skip to content</a>
    <header className="axiom-nav"><a href="#top" className="axiom-brand"><span className="axiom-logo"><i /><b /><em /></span>AXIOM <small>GRID</small></a><nav><a href="#fabric">Fabric</a><a href="#protocol">Protocol</a><a href="#access">Access</a></nav><button type="button" className="axiom-access" onClick={openAccess}>Request access <ArrowUpRight /></button><button type="button" aria-label="Toggle menu" className="axiom-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    {menu && <nav className="axiom-mobile"><a href="#fabric" onClick={() => setMenu(false)}>Fabric</a><a href="#protocol" onClick={() => setMenu(false)}>Protocol</a><button type="button" onClick={openAccess}>Request access</button></nav>}
    <main id="axiom-main">
      <section className="axiom-hero"><div className="axiom-hero-copy"><p className="axiom-kicker">SYSTEMS / FOR THE NEXT CONSTRAINT</p><h1>Compute has<br /><span>a new</span> shape.</h1><p className="axiom-lede">Axiom Grid gives infrastructure teams a spatial command layer for distributed AI workloads—without turning every decision into a ticket.</p><div className="axiom-actions"><button type="button" onClick={openAccess}>Enter the grid <ArrowUpRight /></button><a href="#fabric">View system plane <span>↓</span></a></div></div><figure className="axiom-visual"><img src="/manus-storage/axiom-grid-hero_46c3b0f8.png" alt="Abstract liquid metal compute lattice" /><div className="axiom-image-wash" /><div className="axiom-node axiom-node-one"><span>37</span><small>ACTIVE ZONES</small></div><div className="axiom-node axiom-node-two"><b>0.82</b><small>LOAD SHAPE</small></div><div className="axiom-rule">REGION // PACIFIC NORTHWEST</div></figure></section>
      <section id="fabric" className="axiom-planes"><div className="axiom-section-head" data-batch-reveal><p>THE CONTROL PLANE</p><h2>Every workload<br />knows <em>where it belongs.</em></h2></div><div className="axiom-plane-list">{planes.map(([no,title,copy]) => <article className="axiom-plane" data-batch-reveal key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p><ArrowUpRight /></article>)}</div></section>
      <section id="protocol" className="axiom-protocol" data-batch-reveal><div><p className="axiom-kicker">OPEN / OBSERVABLE / DELIBERATE</p><h2>Control the system<br />without closing the view.</h2></div><div className="axiom-metric-grid"><article><Database /><strong>Workload-aware</strong><span>Routes speak in practical capacity, not abstract infrastructure language.</span></article><article><ShieldCheck /><strong>Policy in view</strong><span>Define what may move, where it can go, and who approved it.</span></article><article><Boxes /><strong>One working map</strong><span>Pair decisions with their active topology, owner, and operational note.</span></article></div></section>
      <section id="access" className="axiom-close"><p>THE GRID IS OPENING</p><h2>Make room for<br />the workload <em>ahead.</em></h2><button type="button" onClick={notify}>Request your architecture brief <ArrowUpRight /></button></section>
    </main><footer className="axiom-footer"><span>AXIOM GRID / INFRASTRUCTURE FOR AI</span><a href="#top">BACK TO ORIGIN ↑</a></footer>
  </div></>;
}
