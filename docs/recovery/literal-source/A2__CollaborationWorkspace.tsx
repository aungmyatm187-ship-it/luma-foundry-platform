import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowUpRight, BookOpenCheck, CheckCircle2, ChevronRight, CircleDotDashed, Handshake, Inbox, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import styles from "./collaboration-workspace.css?raw";

const roles = ["owner", "operator_a", "operator_b"] as const;
const roleLabel = { owner: "You", operator_a: "Operator A", operator_b: "Operator B" } as const;
const queueOrder = ["backlog", "ready", "in_progress", "blocked", "review", "done"] as const;
const shortDate = (value: Date | string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function CollaborationWorkspace() {
  return <DashboardLayout><WorkspaceBoard /></DashboardLayout>;
}

function WorkspaceBoard() {
  const utils = trpc.useUtils();
  const snapshot = trpc.workspace.snapshot.useQuery();
  const [goalTitle, setGoalTitle] = useState("");
  const [goalOutcome, setGoalOutcome] = useState("");
  const [goalPriority, setGoalPriority] = useState<"focus" | "next" | "later">("focus");
  const [composer, setComposer] = useState<"product" | "work" | "handoff" | "decision">("work");
  const [recordTitle, setRecordTitle] = useState("");
  const [recordDetail, setRecordDetail] = useState("");
  const [recordGoalId, setRecordGoalId] = useState("");
  const [recordProductId, setRecordProductId] = useState("");
  const [workType, setWorkType] = useState<"task" | "support">("task");
  const [assignedTo, setAssignedTo] = useState<(typeof roles)[number]>("operator_a");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [fromRole, setFromRole] = useState<(typeof roles)[number]>("owner");
  const [toRole, setToRole] = useState<(typeof roles)[number]>("operator_a");
  const [productCategory, setProductCategory] = useState("");
  const [productRoute, setProductRoute] = useState("");
  const goalId = Number(recordGoalId || snapshot.data?.goals[0]?.id || 0);
  const productId = recordProductId ? Number(recordProductId) : null;

  const invalidate = async () => { await utils.workspace.snapshot.invalidate(); };
  const createGoal = trpc.workspace.createGoal.useMutation({ onSuccess: async () => { await invalidate(); setGoalTitle(""); setGoalOutcome(""); toast.success("Goal created"); }, onError: (error) => toast.error(error.message) });
  const createProduct = trpc.workspace.createProduct.useMutation({ onSuccess: async () => { await invalidate(); resetComposer(); toast.success("Product added"); }, onError: (error) => toast.error(error.message) });
  const createWork = trpc.workspace.createWorkItem.useMutation({ onSuccess: async () => { await invalidate(); resetComposer(); toast.success("Work item saved"); }, onError: (error) => toast.error(error.message) });
  const createHandoff = trpc.workspace.createHandoff.useMutation({ onSuccess: async () => { await invalidate(); resetComposer(); toast.success("Handoff sent to the relay"); }, onError: (error) => toast.error(error.message) });
  const createDecision = trpc.workspace.createDecision.useMutation({ onSuccess: async () => { await invalidate(); resetComposer(); toast.success("Decision request saved"); }, onError: (error) => toast.error(error.message) });
  const updateWork = trpc.workspace.updateWorkItemStatus.useMutation({ onSuccess: invalidate, onError: (error) => toast.error(error.message) });
  const updateDecision = trpc.workspace.updateDecisionStatus.useMutation({ onSuccess: invalidate, onError: (error) => toast.error(error.message) });

  function resetComposer() { setRecordTitle(""); setRecordDetail(""); setProductCategory(""); setProductRoute(""); setRecordProductId(""); }
  function submitGoal(event: FormEvent) { event.preventDefault(); createGoal.mutate({ title: goalTitle, outcome: goalOutcome, priority: goalPriority }); }
  function submitRecord(event: FormEvent) {
    event.preventDefault();
    if (!goalId) return toast.error("Create a goal before adding this record.");
    if (composer === "product") return createProduct.mutate({ goalId, name: recordTitle, category: productCategory, route: productRoute || undefined });
    if (composer === "work") return createWork.mutate({ goalId, productId, type: workType, assignedTo, title: recordTitle, detail: recordDetail || undefined, priority });
    if (composer === "handoff") return createHandoff.mutate({ goalId, productId, fromRole, toRole, title: recordTitle, summary: recordDetail, asks: "" });
    createDecision.mutate({ goalId, productId, title: recordTitle, context: recordDetail });
  }

  const data = snapshot.data;
  const selectedProducts = useMemo(() => data?.products.filter((product) => product.goalId === goalId) ?? [], [data?.products, goalId]);
  if (snapshot.isLoading) return <div className="workspace-loading"><Loader2 className="animate-spin" /> Loading your workspace…</div>;
  if (snapshot.error) return <div className="workspace-loading workspace-error"><AlertCircle /> {snapshot.error.message}</div>;
  const goals = data?.goals ?? [];
  const workItems = data?.workItems ?? [];
  const handoffs = data?.handoffs ?? [];
  const decisions = data?.decisions ?? [];
  const products = data?.products ?? [];
  const activeGoal = goals.find((goal) => goal.id === goalId) ?? goals[0];

  return <><style>{styles}</style><div className="workspace-shell">
    <header className="workspace-top"><div><p>OPERATOR STUDIO / CONTROL ROOM</p><h1>Make the work <em>legible.</em></h1><span>Your goal sets the direction. Operator A and Operator B hand work forward in the open.</span></div><div className="workspace-rule"><i /><span>PRIVATE WORKSPACE</span></div></header>
    <section className="workspace-principles" aria-label="Workspace rules"><div><Target /><strong>You set priority</strong><span>Goals and decisions stay owned by you.</span></div><div><Handshake /><strong>Clear handoffs</strong><span>Every ask has an author and recipient.</span></div><div><BookOpenCheck /><strong>No silent automation</strong><span>Updates are recorded deliberately, not assumed.</span></div></section>
    <section className="workspace-grid">
      <article className="workspace-panel workspace-goal-panel"><div className="workspace-panel-head"><span>01 / GOAL COMPASS</span><Target /></div>{goals.length ? <div className="workspace-goal-list">{goals.map((goal) => <button className={`workspace-goal ${activeGoal?.id === goal.id ? "is-active" : ""}`} key={goal.id} onClick={() => setRecordGoalId(String(goal.id))}><i>{goal.priority}</i><strong>{goal.title}</strong><p>{goal.outcome}</p><small>{goal.status} · updated {shortDate(goal.updatedAt)}</small><ChevronRight /></button>)}</div> : <div className="workspace-empty"><Sparkles /><h2>Set the first direction.</h2><p>Start with the outcome that will decide what Operators A and B should help move next.</p></div>}<form className="workspace-form workspace-goal-form" onSubmit={submitGoal}><label>Goal title<input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. Launch Batch 01 storefront" required /></label><label>What does done look like?<textarea value={goalOutcome} onChange={(e) => setGoalOutcome(e.target.value)} placeholder="A clear, observable outcome—not a vague ambition." required /></label><div className="workspace-inline"><label>Priority<select value={goalPriority} onChange={(e) => setGoalPriority(e.target.value as typeof goalPriority)}><option value="focus">Focus now</option><option value="next">Next</option><option value="later">Later</option></select></label><button className="workspace-primary" disabled={createGoal.isPending}>{createGoal.isPending ? "Saving…" : <><Plus /> Add goal</>}</button></div></form></article>
      <article className="workspace-panel workspace-status-panel"><div className="workspace-panel-head"><span>02 / PRODUCTION PULSE</span><CircleDotDashed /></div><div className="workspace-metrics"><div><strong>{products.length}</strong><span>products</span></div><div><strong>{workItems.filter((item) => item.status !== "done").length}</strong><span>open items</span></div><div><strong>{handoffs.filter((item) => item.status === "open").length}</strong><span>open handoffs</span></div><div><strong>{decisions.filter((item) => item.status === "pending").length}</strong><span>decisions</span></div></div><div className="workspace-queues"><div><p>OPERATOR A</p>{workItems.filter((item) => item.assignedTo === "operator_a" && item.status !== "done").slice(0, 3).map((item) => <QueueLine key={item.id} title={item.title} status={item.status} />)}{!workItems.some((item) => item.assignedTo === "operator_a" && item.status !== "done") && <span>Queue clear</span>}</div><div><p>OPERATOR B</p>{workItems.filter((item) => item.assignedTo === "operator_b" && item.status !== "done").slice(0, 3).map((item) => <QueueLine key={item.id} title={item.title} status={item.status} />)}{!workItems.some((item) => item.assignedTo === "operator_b" && item.status !== "done") && <span>Queue clear</span>}</div></div></article>
      <article className="workspace-panel workspace-composer"><div className="workspace-panel-head"><span>03 / OPEN A RECORD</span><Plus /></div><div className="workspace-tabs" role="tablist">{(["work", "handoff", "decision", "product"] as const).map((item) => <button role="tab" aria-selected={composer === item} className={composer === item ? "is-active" : ""} key={item} onClick={() => { setComposer(item); resetComposer(); }}>{item === "work" ? "Work / support" : item}</button>)}</div>{goals.length ? <form className="workspace-form" onSubmit={submitRecord}><label>Goal<select value={recordGoalId || String(goals[0].id)} onChange={(e) => { setRecordGoalId(e.target.value); setRecordProductId(""); }}>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>{composer !== "product" && <label>Related product <select value={recordProductId} onChange={(e) => setRecordProductId(e.target.value)}><option value="">No product selected</option>{selectedProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}<label>{composer === "product" ? "Product name" : composer === "handoff" ? "Handoff title" : composer === "decision" ? "Decision needed" : "Work title"}<input value={recordTitle} onChange={(e) => setRecordTitle(e.target.value)} required placeholder={composer === "decision" ? "What must be decided?" : "Name the next concrete move"} /></label>{composer === "product" ? <><label>Category<input value={productCategory} onChange={(e) => setProductCategory(e.target.value)} required placeholder="e.g. AI Infrastructure" /></label><label>Live route or preview URL <input value={productRoute} onChange={(e) => setProductRoute(e.target.value)} placeholder="Optional for a concept" /></label></> : <label>{composer === "handoff" ? "Context and ask" : composer === "decision" ? "Decision context" : "Detail"}<textarea value={recordDetail} onChange={(e) => setRecordDetail(e.target.value)} required={composer !== "work"} placeholder="Make the context useful to the next person." /></label>}{composer === "work" && <div className="workspace-inline workspace-three"><label>Type<select value={workType} onChange={(e) => setWorkType(e.target.value as typeof workType)}><option value="task">Task</option><option value="support">Support need</option></select></label><label>Owner<select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value as typeof assignedTo)}>{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label><label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>}{composer === "handoff" && <div className="workspace-inline"><label>From<select value={fromRole} onChange={(e) => setFromRole(e.target.value as typeof fromRole)}>{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label><label>To<select value={toRole} onChange={(e) => setToRole(e.target.value as typeof toRole)}>{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label></div>}<button className="workspace-primary" disabled={createProduct.isPending || createWork.isPending || createHandoff.isPending || createDecision.isPending}><Plus />{composer === "product" ? "Add product" : composer === "handoff" ? "Send handoff" : composer === "decision" ? "Log decision" : "Add to queue"}</button></form> : <div className="workspace-empty"><Inbox /><h2>Goal first.</h2><p>Create an outcome in the Goal Compass, then add products, work, handoffs, and decisions here.</p></div>}</article>
    </section>
    <section className="workspace-board"><div className="workspace-section-head"><div><p>04 / THE WORK BOARD</p><h2>Everyone can see<br/>the <em>next hand.</em></h2></div><span>{activeGoal ? activeGoal.title : "No goal selected"}</span></div><div className="workspace-lanes">{queueOrder.map((status) => <div className="workspace-lane" key={status}><header><span>{status.replace("_", " ")}</span><i>{workItems.filter((item) => item.status === status).length}</i></header>{workItems.filter((item) => item.status === status).map((item) => <article key={item.id}><small>{item.type} / {roleLabel[item.assignedTo]}</small><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}<select aria-label={`Status for ${item.title}`} value={item.status} onChange={(e) => updateWork.mutate({ id: item.id, status: e.target.value as typeof item.status })}>{queueOrder.map((option) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></article>)}{!workItems.some((item) => item.status === status) && <div className="workspace-lane-empty">No items</div>}</div>)}</div></section>
    <section className="workspace-grid workspace-ledgers"><article className="workspace-panel"><div className="workspace-panel-head"><span>05 / OPERATOR RELAY</span><Handshake /></div><div className="workspace-ledger-list">{handoffs.map((handoff) => <article key={handoff.id}><small>{roleLabel[handoff.fromRole]} <ArrowUpRight /> {roleLabel[handoff.toRole]} · {handoff.status}</small><h3>{handoff.title}</h3><p>{handoff.summary}</p></article>)}{!handoffs.length && <div className="workspace-empty compact"><Handshake /><p>Handoffs will appear here with their author, recipient, context, and status.</p></div>}</div></article><article className="workspace-panel"><div className="workspace-panel-head"><span>06 / DECISION LEDGER</span><CheckCircle2 /></div><div className="workspace-ledger-list">{decisions.map((decision) => <article key={decision.id}><small>{decision.status} · {shortDate(decision.createdAt)}</small><h3>{decision.title}</h3><p>{decision.context}</p><select aria-label={`Decision status for ${decision.title}`} value={decision.status} onChange={(e) => updateDecision.mutate({ id: decision.id, status: e.target.value as typeof decision.status })}><option value="pending">pending</option><option value="approved">approved</option><option value="declined">declined</option></select></article>)}{!decisions.length && <div className="workspace-empty compact"><CheckCircle2 /><p>Decisions stay visible until you approve or decline them.</p></div>}</div></article></section>
  </div></>;
}

function QueueLine({ title, status }: { title: string; status: string }) { return <div className="workspace-queue-line"><i className={status} /><span>{title}</span><small>{status.replace("_", " ")}</small></div>; }
