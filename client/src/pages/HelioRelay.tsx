import { ArrowRight, ArrowUpRight, Headphones, Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useBatchReveal } from "@/hooks/useBatchReveal";
import styles from "./batch-02.css?raw";

const relays = [["A customer starts here", "Bring the full conversation into view, whatever channel it began in."], ["AI clears the runway", "Create a grounded first response from the knowledge your team already trusts."], ["Your people take it further", "Hand complex moments to the person best equipped to resolve them well."]];

export default function HelioRelay() {
  const [menu, setMenu] = useState(false);
  useBatchReveal();
  const contact = () => toast("Demo request noted", { description: "Helio Relay is staged as a premium product concept." });
  return <><style>{styles}</style><div className="helio-page" id="helio-top"><a className="b2-skip helio-skip" href="#helio-main">Skip to content</a>
    <header className="helio-nav"><a href="#helio-top" className="helio-brand"><span>helio</span><i>relay</i></a><nav><a href="#conversation">Conversation</a><a href="#quality">Quality</a><a href="#demo">Demo</a></nav><button onClick={contact}>See a demo <ArrowUpRight /></button><button aria-label="Toggle menu" className="helio-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    {menu && <nav className="helio-mobile"><a href="#conversation" onClick={() => setMenu(false)}>Conversation</a><a href="#quality" onClick={() => setMenu(false)}>Quality</a><button onClick={contact}>See a demo</button></nav>}
    <main id="helio-main"><section className="helio-hero"><div className="helio-hero-copy"><p>THE SERVICE LAYER THAT KEEPS ITS WARMTH</p><h1>Every<br />conversation<br /><em>has a way through.</em></h1><p>Helio Relay gives service teams an intelligent starting point and the context to make each resolution feel considered.</p><div><button onClick={contact}>Follow the conversation <ArrowRight /></button><span><Headphones /> HUMAN HELP, IN THE RIGHT MOMENT</span></div></div><figure><img src="/manus-storage/helio-relay-hero_9fba7064.png" alt="Warm ivory abstract conversation ribbons in yellow and aubergine" /><figcaption><span>01</span>CONTEXT / CONNECTED <Sparkles /></figcaption></figure></section>
    <section id="conversation" className="helio-relay"><div className="helio-relay-head" data-batch-reveal><p>ONE CONTINUOUS RELAY</p><h2>Make every next<br />message feel <em>informed.</em></h2></div><div className="helio-ribbon"><span aria-hidden="true" /><div className="helio-ribbon-cards">{relays.map(([title,copy], index) => <article key={title} data-batch-reveal><b>0{index + 1}</b><h3>{title}</h3><p>{copy}</p><ArrowRight /></article>)}</div></div></section>
    <section id="quality" className="helio-quality" data-batch-reveal><div><p>QUALITY IS SOMETHING YOU CAN HEAR.</p><h2>Let the team see<br />what a good<br /><em>answer needs.</em></h2></div><aside><span>“</span><p>“Good service keeps the customer’s context whole—then gives the right person room to make it better.”</p><small>HELIO RELAY / QUALITY PRINCIPLE</small></aside></section>
    <section id="demo" className="helio-close" data-batch-reveal><p>RESOLVE MORE. STAY HUMAN.</p><button onClick={contact}>See Helio Relay in your service flow <ArrowUpRight /></button></section></main>
    <footer className="helio-footer"><span>HELIO RELAY / SERVICE, KEPT HUMAN</span><a href="#helio-top">BEGIN AGAIN ↑</a></footer>
  </div></>;
}
