import { ArrowUpRight, Layers3, Menu, MoveUpRight, Sparkles, WandSparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBatchReveal } from "@/hooks/useBatchReveal";
import styles from "./batch-02.css?raw";

const experiments = [["01", "Find the visual tension", "Start with the sharpest version of your point of view, not a safe middle."], ["02", "Build a usable system", "Turn one good decision into a kit your people can actually work with."], ["03", "Let the work travel", "Create campaign pieces that bend without breaking the brand’s character."]];

export default function FolioForms() {
  const [menu, setMenu] = useState(false);
  useBatchReveal();
  const contact = () => toast("System generation preview opened", { description: "Folio Forms is staged as a premium product concept." });
  return <><style>{styles}</style><div className="folio-page" id="folio-top"><a className="b2-skip folio-skip" href="#folio-main">Skip to content</a>
    <header className="folio-nav"><a href="#folio-top" className="folio-brand">FOLIO<span>FORMS</span></a><nav><a href="#experiments">Experiments</a><a href="#output">Outputs</a><a href="#generate">Generate</a></nav><button onClick={contact}>Generate a system <WandSparkles /></button><button aria-label="Toggle menu" className="folio-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    {menu && <nav className="folio-mobile"><a href="#experiments" onClick={() => setMenu(false)}>Experiments</a><a href="#output" onClick={() => setMenu(false)}>Outputs</a><button onClick={contact}>Generate a system</button></nav>}
    <main id="folio-main"><section className="folio-hero"><div className="folio-hero-copy"><p><span />A GENERATIVE ATELIER FOR BRANDS WITH RANGE</p><h1>A brand<br />should <em>move.</em></h1><p>Folio Forms gives creative teams a space to discover a visual system with enough point of view to keep producing.</p><button onClick={contact}>Start with a spark <ArrowUpRight /></button></div><figure><img src="/manus-storage/folio-forms-hero_80ca4506.png" alt="Ultramarine and acid lime collage of artboard materials" /><span className="folio-sticker">MAKE<br />SOMETHING<br />THAT MOVES</span><figcaption><Layers3 />ARTBOARD / ACTIVE</figcaption></figure></section>
    <section id="experiments" className="folio-experiments"><div className="folio-experiments-head" data-batch-reveal><p>FROM A FIRST SPARK</p><h2>To a system<br />with its own <em>gravity.</em></h2></div><div className="folio-experiment-grid">{experiments.map(([number,title,copy], index) => <article key={number} data-batch-reveal className={`folio-card-${index + 1}`}><span>{number}</span><h3>{title}</h3><p>{copy}</p><MoveUpRight /></article>)}</div></section>
    <section id="output" className="folio-output" data-batch-reveal><div className="folio-output-art" aria-hidden="true"><i /><b /><em /></div><div><p>FORM / FLEX / REPEAT</p><h2>Campaign outputs<br />that stay <em>in character.</em></h2><p>Push a distinct voice through pages, social surfaces, and launch materials—without sanding away what made it interesting.</p></div></section>
    <section id="generate" className="folio-close" data-batch-reveal><p>YOU HAVE THE SPARK. NOW GIVE IT A SYSTEM.</p><button onClick={contact}>Generate your brand system <Sparkles /></button></section></main>
    <footer className="folio-footer"><span>FOLIO FORMS / THE DIGITAL ATELIER</span><a href="#folio-top">BACK TO THE SPARK ↑</a></footer>
  </div></>;
}
