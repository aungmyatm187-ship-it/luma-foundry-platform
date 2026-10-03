/**
 * Studio index design reminder: neutral, gallery-like selection surface that keeps Ember Signal
 * and Noor Vale visually distinct while clearly routing visitors to either complete website.
 */
import { ArrowUpRight, Sparkles } from "lucide-react";

const destinations = [
  {
    label: "AI infrastructure",
    title: "Axiom Grid",
    description: "A liquid-metal infrastructure narrative for compute teams that build for the next constraint.",
    href: "/axiom-grid",
    image: "/manus-storage/axiom-grid-hero_46c3b0f8.png",
    tone: "axiom",
    status: "BATCH 01 / PRODUCT",
  },
  {
    label: "Agent orchestration",
    title: "Selene Agents",
    description: "A quiet-luxury agent workspace designed around human judgement, clear boundaries, and elegant control.",
    href: "/selene-agents",
    image: "/manus-storage/selene-agents-hero_9dd8b039.png",
    tone: "selene",
    status: "BATCH 01 / PRODUCT",
  },
  {
    label: "Automation platform",
    title: "Kinetic Mesh",
    description: "An industrial no-code system where the repeatable work keeps moving and the important work stays human.",
    href: "/kinetic-mesh",
    image: "/manus-storage/kinetic-mesh-hero_682e14df.png",
    tone: "kinetic",
    status: "BATCH 01 / PRODUCT",
  },
  {
    label: "Research intelligence",
    title: "Lattice Labs",
    description: "A scientific evidence layer for teams who need to find the reason before they make the move.",
    href: "/lattice-labs",
    image: "/manus-storage/lattice-labs-hero_587c9d31.png",
    tone: "lattice",
    status: "BATCH 01 / PRODUCT",
  },
  {
    label: "CFO intelligence",
    title: "Orbital Ledger",
    description: "A composed financial-planning system for leadership teams navigating the next horizon together.",
    href: "/orbital-ledger",
    image: "/manus-storage/orbital-ledger-hero_d99df92d.png",
    tone: "orbital",
    status: "BATCH 01 / PRODUCT",
  },
  {
    label: "Care-operations AI",
    title: "Stilla Care Systems",
    description: "A calm clinical operations system that helps care teams move the next patient moment forward with shared clarity.",
    href: "/stilla-care-systems",
    image: "/manus-storage/stilla-care-hero_1ac443b2.png",
    tone: "stilla",
    status: "BATCH 02 / PRODUCT",
  },
  {
    label: "Edge AI hardware",
    title: "Morrow Compute",
    description: "Precision edge hardware for teams that need low-latency intelligence in the places work actually happens.",
    href: "/morrow-compute",
    image: "/manus-storage/morrow-compute-hero_c6e8b9b7.png",
    tone: "morrow",
    status: "BATCH 02 / PRODUCT",
  },
  {
    label: "AI governance",
    title: "Vanta Proof",
    description: "An evidence-first trust system that makes AI controls ready to explain, test, and stand behind.",
    href: "/vanta-proof",
    image: "/manus-storage/vanta-proof-hero_9690cc5e.png",
    tone: "vanta",
    status: "BATCH 02 / PRODUCT",
  },
  {
    label: "Service AI",
    title: "Helio Relay",
    description: "A warm, accountable conversation layer that lets service teams resolve more without losing their human voice.",
    href: "/helio-relay",
    image: "/manus-storage/helio-relay-hero_9fba7064.png",
    tone: "helio",
    status: "BATCH 02 / PRODUCT",
  },
  {
    label: "Generative brand platform",
    title: "Folio Forms",
    description: "A digital atelier where brand teams turn the first spark into a flexible visual system with range.",
    href: "/folio-forms",
    image: "/manus-storage/folio-forms-hero_80ca4506.png",
    tone: "folio",
    status: "BATCH 02 / PRODUCT",
  },
  {
    label:"Brand and digital agency",title:"Sable & Type",description:"Chromatic editorial systems for brand change.",href:"/sable-type",image:"/manus-storage/folio-forms-hero_80ca4506.png",tone:"sable",status:"BATCH 09 / PRODUCT",
  },{
    label:"Urban strategy",title:"Civic Assembly",description:"A broadsheet interface for public-place thinking.",href:"/civic-assembly",image:"/manus-storage/lattice-labs-hero_587c9d31.png",tone:"civic",status:"BATCH 09 / PRODUCT",
  },{
    label:"Commercial film",title:"Masonry Films",description:"Screen-first production work for work that needs motion.",href:"/masonry-films",image:"/manus-storage/ember-signal-hero_00d7a28a.png",tone:"masonry",status:"BATCH 09 / PRODUCT",
  },{
    label:"Legal advisory",title:"Northline Counsel",description:"Clear counsel organised by decisive business moments.",href:"/northline-counsel",image:"/manus-storage/aster-alder-hero_6150ee6b.png",tone:"northline",status:"BATCH 09 / PRODUCT",
  },{
    label:"Creative education",title:"Pattern School",description:"A playful academic system for creative practice.",href:"/pattern-school",image:"/manus-storage/kinetic-mesh-hero_682e14df.png",tone:"pattern",status:"BATCH 09 / PRODUCT",
  },{
    label:"Fine food and table goods",title:"Vesper Pantry",description:"A refined market-stall route to better ingredients.",href:"/vesper-pantry",image:"/manus-storage/sardis-parfums-hero_fb56c403.png",tone:"vesper",status:"BATCH 08 / PRODUCT",
  },{
    label:"Design tools",title:"Arq Supply",description:"A utilitarian professional tool matrix for architects.",href:"/arq-supply",image:"/manus-storage/lattice-labs-hero_587c9d31.png",tone:"arq",status:"BATCH 08 / PRODUCT",
  },{
    label:"Travel accessories",title:"Perrin Carry",description:"A cartographic carry system built around real journeys.",href:"/perrin-carry",image:"/manus-storage/aster-alder-hero_6150ee6b.png",tone:"perrin",status:"BATCH 08 / PRODUCT",
  },{
    label:"Botanical personal care",title:"Wildercare",description:"Transparent formulas arranged around everyday ritual.",href:"/wildercare",image:"/manus-storage/elan-method-hero_3f354c21.png",tone:"wilder",status:"BATCH 08 / PRODUCT",
  },{
    label:"Children’s design",title:"Havenlark",description:"Parent-first essentials with soft orbit playfulness.",href:"/havenlark",image:"/manus-storage/folio-forms-hero_80ca4506.png",tone:"haven",status:"BATCH 08 / PRODUCT",
  },{
    label:"Artful homewares",title:"Kansa Objects",description:"Japanese retail poetry for useful objects.",href:"/kansa-objects",image:"/manus-storage/peregrine-editions-hero_1d238e82.png",tone:"kansa",status:"BATCH 07 / PRODUCT",
  },{
    label:"Specialty coffee",title:"Ora Roasters",description:"A tactile roast-house subscription and coffee finder.",href:"/ora-roasters",image:"/manus-storage/sardis-parfums-hero_fb56c403.png",tone:"ora",status:"BATCH 07 / PRODUCT",
  },{
    label:"Running apparel",title:"Corella Run",description:"A high-velocity performance system for the long run.",href:"/corella-run",image:"/manus-storage/kinetic-mesh-hero_682e14df.png",tone:"corella",status:"BATCH 07 / PRODUCT",
  },{
    label:"High-fidelity speakers",title:"Solace Audio",description:"Sound architecture for deeply considered listening.",href:"/solace-audio",image:"/manus-storage/orbital-ledger-hero_d99df92d.png",tone:"solace",status:"BATCH 07 / PRODUCT",
  },{
    label:"Elevated pet goods",title:"Basil & Bone",description:"A bold companion-goods store with real warmth.",href:"/basil-bone",image:"/manus-storage/helio-relay-hero_9fba7064.png",tone:"basil",status:"BATCH 07 / PRODUCT",
  },{
    label: "Private event venue", title: "Maison Rook", description: "A modern romantic venue site with a date-led conversion journey.", href: "/maison-rook", image: "/manus-storage/vela-maison-hero_742c864d.png", tone: "rook", status: "BATCH 06 / PRODUCT",
  },
  {
    label: "Landscape architecture", title: "Terra Forma", description: "A topographic landscape practice shaped by ecology, fieldwork, and contours.", href: "/terra-forma", image: "/manus-storage/ruth-ibarra-hero_f96d0ab9.png", tone: "terra", status: "BATCH 06 / PRODUCT",
  },
  {
    label: "Urban development", title: "Veloce District", description: "A metropolitan mixed-use launch surface for a district in motion.", href: "/veloce-district", image: "/manus-storage/tempo-atelier-hero_1f98ce9e.png", tone: "veloce", status: "BATCH 06 / PRODUCT",
  },
  {
    label: "Premium furnishings", title: "Hinge & Hearth", description: "A radical product catalogue for furniture with character and colour.", href: "/hinge-hearth", image: "/manus-storage/caldera-optical-hero_71ee1be6.png", tone: "hinge", status: "BATCH 06 / PRODUCT",
  },
  {
    label: "Design cabins", title: "Fieldnote Cabins", description: "A wilderness-stay finder built around the trail, weather, and time outside.", href: "/fieldnote-cabins", image: "/manus-storage/mare-house-hero_63a2703a.png", tone: "field", status: "BATCH 06 / PRODUCT",
  },
  {
    label: "Contemporary architecture",
    title: "Monolith Works",
    description: "A concrete-gallery practice for cultural buildings, public ground, and exacting spatial ideas.",
    href: "/monolith-works",
    image: "/manus-storage/tempo-atelier-hero_1f98ce9e.png",
    tone: "monolith",
    status: "BATCH 05 / PRODUCT",
  },
  {
    label: "Luxury property brokerage",
    title: "Nocturne Estates",
    description: "A cinematic brokerage for private residences selected around place, light, and possibility.",
    href: "/nocturne-estates",
    image: "/manus-storage/mare-house-hero_63a2703a.png",
    tone: "nocturne",
    status: "BATCH 05 / PRODUCT",
  },
  {
    label: "Boutique hotel",
    title: "Alder House",
    description: "A heritage-modern hotel where a considered room and a good table set the pace.",
    href: "/alder-house",
    image: "/manus-storage/ruth-ibarra-hero_f96d0ab9.png",
    tone: "alder",
    status: "BATCH 05 / PRODUCT",
  },
  {
    label: "Residential interiors",
    title: "Formwell Interiors",
    description: "Warm, material-led homes designed around proportion, texture, and how life is lived.",
    href: "/formwell-interiors",
    image: "/manus-storage/peregrine-editions-hero_1d238e82.png",
    tone: "formwell",
    status: "BATCH 05 / PRODUCT",
  },
  {
    label: "Architectural lighting",
    title: "Studio Lumen",
    description: "A high-contrast lighting laboratory that brings spatial systems into focus.",
    href: "/studio-lumen",
    image: "/manus-storage/caldera-optical-hero_71ee1be6.png",
    tone: "lumen",
    status: "BATCH 05 / PRODUCT",
  },
  {
    label: "Floral studio",
    title: "Ruth Ibarra Botanics",
    description: "Seasonal floral work arranged with the beauty and calm precision of a living botanical study.",
    href: "/ruth-ibarra-botanics",
    image: "/manus-storage/ruth-ibarra-hero_f96d0ab9.png",
    tone: "ruth",
    status: "BATCH 04 / PRODUCT",
  },
  {
    label: "Independent watchmaker",
    title: "Tempo Atelier",
    description: "Mechanical watches engineered as lasting instruments for time kept personally.",
    href: "/tempo-atelier",
    image: "/manus-storage/tempo-atelier-hero_1f98ce9e.png",
    tone: "tempo",
    status: "BATCH 04 / PRODUCT",
  },
  {
    label: "Art and objects",
    title: "Peregrine Editions",
    description: "A modern viewing room for singular objects, limited editions, and collecting with curiosity.",
    href: "/peregrine-editions",
    image: "/manus-storage/peregrine-editions-hero_1d238e82.png",
    tone: "peregrine",
    status: "BATCH 04 / PRODUCT",
  },
  {
    label: "Design eyewear",
    title: "Caldera Optical",
    description: "Frames shaped by desert light, technical craft, and a more personal way to see.",
    href: "/caldera-optical",
    image: "/manus-storage/caldera-optical-hero_71ee1be6.png",
    tone: "caldera",
    status: "BATCH 04 / PRODUCT",
  },
  {
    label: "Coastal wellness retreat",
    title: "Maré House",
    description: "A coastal stay composed around restorative quiet, tide-paced days, and deep ease.",
    href: "/mare-house",
    image: "/manus-storage/mare-house-hero_63a2703a.png",
    tone: "mare",
    status: "BATCH 04 / PRODUCT",
  },
  {
    label: "Editorial fashion",
    title: "Noor Vale",
    description: "An editorial fashion portfolio with a responsive masonry gallery and glass image captions.",
    href: "/noor-vale",
    image: "/manus-storage/noor-fashion-hero_f40d2c42.png",
    tone: "noor",
    status: "BATCH 03 / PRODUCT",
  },
  {
    label: "Fine jewellery",
    title: "Aster & Alder",
    description: "A midnight vitrine for objects formed slowly, selected personally, and held close for years.",
    href: "/aster-alder",
    image: "/manus-storage/aster-alder-hero_6150ee6b.png",
    tone: "aster",
    status: "BATCH 03 / PRODUCT",
  },
  {
    label: "Premium skin studio",
    title: "Élan Method",
    description: "A considered facial-care studio where advanced treatment is delivered at a human pace.",
    href: "/elan-method",
    image: "/manus-storage/elan-method-hero_3f354c21.png",
    tone: "elan",
    status: "BATCH 03 / PRODUCT",
  },
  {
    label: "Couture bridal",
    title: "Vela Maison",
    description: "A quiet couture atelier for brides who want the dress to remember the person, not the trend.",
    href: "/vela-maison",
    image: "/manus-storage/vela-maison-hero_742c864d.png",
    tone: "vela",
    status: "BATCH 03 / PRODUCT",
  },
  {
    label: "Niche fragrance",
    title: "Sardis Parfums",
    description: "A cinematic fragrance house built around scenes, senses, and singular ingredients.",
    href: "/sardis-parfums",
    image: "/manus-storage/sardis-parfums-hero_fb56c403.png",
    tone: "sardis",
    status: "BATCH 03 / PRODUCT",
  },
  {
    label: "AI operations layer",
    title: "Luma Intelligence",
    description: "A prismatic decision-intelligence platform for teams that need every key signal, source, and next move in view.",
    href: "/luma-intelligence",
    image: "/manus-storage/luma-intelligence-hero_82135acf.png",
    tone: "luma",
    status: "PRODUCT WEBSITE",
  },
  {
    label: "AI marketing intelligence",
    title: "Ember Signal",
    description: "An original nocturnal campaign-intelligence site built around evidence, momentum, and market signals.",
    href: "/ember-signal",
    image: "/manus-storage/luma-intelligence-hero_82135acf.png",
    tone: "ember",
    status: "PRODUCT WEBSITE",
  },
];

export default function Home() {
  return (
    <main className="site-index min-h-screen overflow-hidden bg-[#0A0B0D] text-[#F6F4EF]">
      <div className="site-index-noise" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex w-full max-w-[1520px] items-center justify-between px-5 py-5 md:px-8 md:py-7">
        <div className="flex items-center gap-3"><span className="index-mark" aria-hidden="true"><i /><b /></span><span className="font-mono text-[11px] font-bold tracking-[.2em] text-[#F6F4EF]">STUDIO / INDEX</span></div>
        <span className="hidden font-mono text-[10px] tracking-[.16em] text-white/40 sm:block">50 ORIGINAL WEBSITE CONCEPTS</span>
      </header>

      <section className="relative z-10 mx-auto max-w-[1520px] px-5 pb-12 pt-12 md:px-8 md:pb-20 md:pt-20">
        <div className="max-w-5xl"><p className="mb-5 flex items-center gap-3 font-mono text-[10px] font-bold tracking-[.18em] text-[#C4C2BC]"><span className="h-px w-8 bg-[#D5FF5A]" />SELECT A WEBSITE</p><h1 className="font-editorial text-[clamp(4.2rem,10vw,10.5rem)] font-semibold leading-[.78] tracking-[-.08em]">50 worlds.<br /><em className="font-normal text-[#D5FF5A]">All yours.</em></h1><p className="mt-8 max-w-xl text-base leading-7 text-white/60 md:text-lg">Every product lives independently. Explore all ten complete production batches—none replaces another.</p></div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-5">
          {destinations.map((destination, index) => (
            <a key={destination.title} href={destination.href} className={`destination-card destination-${destination.tone} group`}>
              <img src={destination.image} alt="" className="destination-image" />
              <div className="destination-shade" />
              <div className="relative flex min-h-[420px] flex-col justify-between p-6 sm:min-h-[520px] sm:p-8 md:p-10">
                <div className="flex items-start justify-between gap-4"><span className="destination-status">{destination.status}</span><span className="grid size-10 place-items-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md transition duration-300 group-hover:rotate-45 group-hover:bg-white group-hover:text-black"><ArrowUpRight className="size-4" /></span></div>
                <div><p className="font-mono text-[10px] font-bold tracking-[.18em] text-white/60">0{index + 1} / {destination.label.toUpperCase()}</p><h2 className="mt-4 font-editorial text-5xl font-semibold leading-[.85] tracking-[-.06em] text-white sm:text-7xl">{destination.title}</h2><p className="mt-5 max-w-md text-sm leading-6 text-white/75 sm:text-base">{destination.description}</p><span className="mt-8 inline-flex items-center gap-2 border-b border-white/70 pb-1 font-mono text-[10px] font-bold tracking-[.14em] text-white">OPEN WEBSITE <ArrowUpRight className="size-3.5" /></span></div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-[1520px] flex-col gap-3 border-t border-white/10 px-5 py-6 font-mono text-[10px] tracking-[.13em] text-white/40 sm:flex-row sm:items-center sm:justify-between md:px-8"><span>PREMIUM PRODUCT FACTORY / 50 INDEPENDENT WEBSITE CONCEPTS</span><span className="flex items-center gap-2"><Sparkles className="size-3 text-[#D5FF5A]" /> SELECT, EXPLORE, KEEP ALL</span></footer>
    </main>
  );
}
