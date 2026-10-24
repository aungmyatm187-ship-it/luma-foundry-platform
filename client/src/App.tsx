import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDocumentTitle } from "@/lib/routeTitles";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AxiomGrid from "./pages/AxiomGrid";
import EmberSignal from "./pages/EmberSignal";
import Home from "./pages/Home";
import KineticMesh from "./pages/KineticMesh";
import LatticeLabs from "./pages/LatticeLabs";
import LumaIntelligence from "./pages/LumaIntelligence";
import OrbitalLedger from "./pages/OrbitalLedger";
import SeleneAgents from "./pages/SeleneAgents";
import CollaborationWorkspace from "./pages/CollaborationWorkspace";
import StillaCareSystems from "./pages/StillaCareSystems";
import MorrowCompute from "./pages/MorrowCompute";
import VantaProof from "./pages/VantaProof";
import HelioRelay from "./pages/HelioRelay";
import FolioForms from "./pages/FolioForms";
import { AsterAlder, ElanMethod, NoorVale, SardisParfums, VelaMaison } from "./pages/LuxuryBatchThree";
import { CalderaOptical, MareHouse, PeregrineEditions, RuthIbarraBotanics, TempoAtelier } from "./pages/LuxuryBatchFour";
import { AlderHouse, FormwellInteriors, MonolithWorks, NocturneEstates, StudioLumen } from "./pages/ArchitectureBatchFive";
import { FieldnoteCabins, HingeHearth, MaisonRook, TerraForma, VeloceDistrict } from "./pages/SpatialBatchSix";
import { BasilBone, CorellaRun, KansaObjects, OraRoasters, SolaceAudio } from "./pages/CommerceBatchSeven";
import { ArqSupply, Havenlark, PerrinCarry, VesperPantry, Wildercare } from "./pages/CommerceBatchEight";
import { CivicAssembly, MasonryFilms, NorthlineCounsel, PatternSchool, SableType } from "./pages/ServiceBatchNine";
import { AdjacentTalent, HinterlandSound, LumenCo, OrielAdvisory, QuorumHouse } from "./pages/ServiceBatchTen";

function Router() {
  // make sure to consider if you need authentication for certain routes
  const [location] = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(location);
  }, [location]);

  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/axiom-grid"} component={AxiomGrid} />
      <Route path={"/selene-agents"} component={SeleneAgents} />
      <Route path={"/kinetic-mesh"} component={KineticMesh} />
      <Route path={"/lattice-labs"} component={LatticeLabs} />
      <Route path={"/orbital-ledger"} component={OrbitalLedger} />
      <Route path={"/stilla-care-systems"} component={StillaCareSystems} />
      <Route path={"/morrow-compute"} component={MorrowCompute} />
      <Route path={"/vanta-proof"} component={VantaProof} />
      <Route path={"/helio-relay"} component={HelioRelay} />
      <Route path={"/folio-forms"} component={FolioForms} />
      <Route path={"/noor-vale"} component={NoorVale} />
      <Route path={"/aster-alder"} component={AsterAlder} />
      <Route path={"/elan-method"} component={ElanMethod} />
      <Route path={"/vela-maison"} component={VelaMaison} />
      <Route path={"/sardis-parfums"} component={SardisParfums} />
      <Route path={"/ruth-ibarra-botanics"} component={RuthIbarraBotanics} />
      <Route path={"/tempo-atelier"} component={TempoAtelier} />
      <Route path={"/peregrine-editions"} component={PeregrineEditions} />
      <Route path={"/caldera-optical"} component={CalderaOptical} />
      <Route path={"/mare-house"} component={MareHouse} />
      <Route path={"/monolith-works"} component={MonolithWorks} />
      <Route path={"/nocturne-estates"} component={NocturneEstates} />
      <Route path={"/alder-house"} component={AlderHouse} />
      <Route path={"/formwell-interiors"} component={FormwellInteriors} />
      <Route path={"/studio-lumen"} component={StudioLumen} />
      <Route path={"/maison-rook"} component={MaisonRook} />
      <Route path={"/terra-forma"} component={TerraForma} />
      <Route path={"/veloce-district"} component={VeloceDistrict} />
      <Route path={"/hinge-hearth"} component={HingeHearth} />
      <Route path={"/fieldnote-cabins"} component={FieldnoteCabins} />
      <Route path={"/kansa-objects"} component={KansaObjects} />
      <Route path={"/ora-roasters"} component={OraRoasters} />
      <Route path={"/corella-run"} component={CorellaRun} />
      <Route path={"/solace-audio"} component={SolaceAudio} />
      <Route path={"/basil-bone"} component={BasilBone} />
      <Route path={"/vesper-pantry"} component={VesperPantry} />
      <Route path={"/arq-supply"} component={ArqSupply} />
      <Route path={"/perrin-carry"} component={PerrinCarry} />
      <Route path={"/wildercare"} component={Wildercare} />
      <Route path={"/havenlark"} component={Havenlark} />
      <Route path={"/sable-type"} component={SableType} />
      <Route path={"/civic-assembly"} component={CivicAssembly} />
      <Route path={"/masonry-films"} component={MasonryFilms} />
      <Route path={"/northline-counsel"} component={NorthlineCounsel} />
      <Route path={"/pattern-school"} component={PatternSchool} />
      <Route path={"/oriel-advisory"} component={OrielAdvisory} />
      <Route path={"/hinterland-sound"} component={HinterlandSound} />
      <Route path={"/quorum-house"} component={QuorumHouse} />
      <Route path={"/adjacent-talent"} component={AdjacentTalent} />
      <Route path={"/lumen-co"} component={LumenCo} />
      <Route path={"/ember-signal"} component={EmberSignal} />
      <Route path={"/luma-intelligence"} component={LumaIntelligence} />
      <Route path={"/workspace"} component={CollaborationWorkspace} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
