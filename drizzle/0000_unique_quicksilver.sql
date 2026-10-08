CREATE TYPE "public"."decision_status" AS ENUM('open', 'approved', 'declined', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('source_commit', 'design_history', 'asset_licence', 'contributor_rights', 'dependency_sbom', 'third_party_notices', 'counsel_review', 'buyer_terms');--> statement-breakpoint
CREATE TYPE "public"."handoff_status" AS ENUM('draft', 'sent', 'accepted', 'returned');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('concept', 'in_build', 'in_review', 'conditional', 'cleared', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'operator_a', 'operator_b');--> statement-breakpoint
CREATE TYPE "public"."work_item_status" AS ENUM('todo', 'in_progress', 'blocked', 'done');--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"product_id" uuid,
	"title" text NOT NULL,
	"context" text NOT NULL,
	"decision" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"decided_by" "role",
	"status" "decision_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"reference" text NOT NULL,
	"note" text NOT NULL,
	"recorded_by" "role" NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text,
	"row_hash" text
);
--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"outcome" text NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"target_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"product_id" uuid,
	"from_role" "role" NOT NULL,
	"to_role" "role" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"asks" text NOT NULL,
	"status" "handoff_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handoffs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"route" text NOT NULL,
	"status" "product_status" DEFAULT 'concept' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"product_id" uuid,
	"type" text NOT NULL,
	"assigned_to" "role" NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"status" "work_item_status" DEFAULT 'todo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_goal_idx" ON "decisions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "evidence_product_idx" ON "evidence" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "goals_owner_idx" ON "goals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "handoffs_goal_idx" ON "handoffs" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "products_goal_idx" ON "products" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "work_items_goal_idx" ON "work_items" USING btree ("goal_id");--> statement-breakpoint
CREATE POLICY "decisions_own_rows" ON "decisions" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "decisions"."goal_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "decisions"."goal_id" and (select auth.uid()) = users.auth_user_id));--> statement-breakpoint
CREATE POLICY "evidence_own_rows" ON "evidence" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from products join goals on goals.id = products.goal_id join users on users.id = goals.owner_id where products.id = "evidence"."product_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from products join goals on goals.id = products.goal_id join users on users.id = goals.owner_id where products.id = "evidence"."product_id" and (select auth.uid()) = users.auth_user_id));--> statement-breakpoint
CREATE POLICY "goals_own_rows" ON "goals" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from users where users.id = "goals"."owner_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from users where users.id = "goals"."owner_id" and (select auth.uid()) = users.auth_user_id));--> statement-breakpoint
CREATE POLICY "handoffs_own_rows" ON "handoffs" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "handoffs"."goal_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "handoffs"."goal_id" and (select auth.uid()) = users.auth_user_id));--> statement-breakpoint
CREATE POLICY "products_own_rows" ON "products" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "products"."goal_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "products"."goal_id" and (select auth.uid()) = users.auth_user_id));--> statement-breakpoint
CREATE POLICY "users_own_rows" ON "users" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "users"."auth_user_id") WITH CHECK ((select auth.uid()) = "users"."auth_user_id");--> statement-breakpoint
CREATE POLICY "work_items_own_rows" ON "work_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "work_items"."goal_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "work_items"."goal_id" and (select auth.uid()) = users.auth_user_id));