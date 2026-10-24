import { ArrowUpRight, Check, LockKeyhole, Menu, ScanSearch, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBatchReveal } from "@/hooks/useBatchReveal";
import styles from "./batch-02.css?raw";

const ledgers = [["Policy", "The rule you can name", "Capture the intent before it is lost in implementation."], ["Control", "The action you can test", "Place practical checks close to the system behaviour they govern."], ["Evidence", "The proof you can stand behind", "Keep a decision-ready record without asking teams to reconstruct history."]];

export default function VantaProof() {
  const [menu, setMenu] = useState(false);
  useBatchReveal();
  const contact = () => toast("Assessment request noted", { description: "Vanta Proof is staged as a premium product concept." });
  return <><style>{styles}</style><div className="vanta-page" id="vanta-top"><a className="b2-skip vanta-skip" href="#vanta-main">Skip to content</a>
    <header className="vanta-nav"><a href="#vanta-top" className="vanta-brand"><span>V</span>ANTA <i>PROOF</i></a><nav><a href="#ledger">Evidence ledger</a><a href="#vault">Vault</a><a href="#trust">Trust centre</a></nav><button onClick={contact}>Schedule assessment <ArrowUpRight /></button><button aria-label="Toggle menu" className="vanta-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    {menu && <nav className="vanta-mobile"><a href="#ledger" onClick={() => setMenu(false)}>Evidence ledger</a><a href="#vault" onClick={() => setMenu(false)}>Vault</a><button onClick={contact}>Schedule assessment</button></nav>}
    <main id="vanta-main"><section className="vanta-hero"><div className="vanta-hero-copy"><p><i />ASSURANCE FOR AI THAT HAS TO ANSWER</p><h1>Trust is a<br /><em>working</em> record.</h1><p>Vanta Proof turns AI governance from a static promise into an evidence system your team can inspect, test, and explain.</p><button onClick={contact}>Open the proof layer <ArrowUpRight /></button></div><figure><img src="/manus-storage/vanta-proof-hero_9690cc5e.png" alt="Abstract obsidian verification vault with ultraviolet and green light" /><div className="vanta-seal"><Check />VERIFIED<br />EVIDENCE</div><figcaption><LockKeyhole />VAULT STATUS / SEALED</figcaption></figure></section>
    <section id="ledger" className="vanta-ledger"><div className="vanta-ledger-head" data-batch-reveal><p>THE EVIDENCE LEDGER</p><h2>Trace the way<br />from intent to <em>proof.</em></h2></div><div className="vanta-ledger-stack">{ledgers.map(([tag,title,copy], index) => <article key={tag} data-batch-reveal><span>0{index + 1}<i /></span><div><p>{tag.toUpperCase()}</p><h3>{title}</h3></div><p>{copy}</p><ArrowUpRight /></article>)}</div></section>
    <section id="vault" className="vanta-vault" data-batch-reveal><div><ScanSearch /><p>INSPECTION READY</p><h2>When the question<br />arrives, <em>be ready.</em></h2></div><div><p>Make every policy, control, and decision available to the people who need confidence—not more complexity.</p><a href="#trust">Visit the trust centre <ArrowUpRight /></a></div></section>
    <section id="trust" className="vanta-close" data-batch-reveal><p>CONTROL IS ONLY REAL WHEN IT CAN BE SHOWN.</p><button onClick={contact}>Schedule your AI governance assessment <ArrowUpRight /></button></section></main>
    <footer className="vanta-footer"><span>VANTA PROOF / GOVERNANCE WITH RECEIPTS</span><a href="#vanta-top">BACK TO VAULT ↑</a></footer>
  </div></>;
}
