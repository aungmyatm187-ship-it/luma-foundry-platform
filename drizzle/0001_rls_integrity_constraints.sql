DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.work_items AS item
    JOIN public.products AS product ON product.id = item.product_id
    WHERE item.product_id IS NOT NULL AND item.goal_id <> product.goal_id
  ) OR EXISTS (
    SELECT 1 FROM public.handoffs AS handoff
    JOIN public.products AS product ON product.id = handoff.product_id
    WHERE handoff.product_id IS NOT NULL AND handoff.goal_id <> product.goal_id
  ) OR EXISTS (
    SELECT 1 FROM public.decisions AS decision
    JOIN public.products AS product ON product.id = decision.product_id
    WHERE decision.product_id IS NOT NULL AND decision.goal_id <> product.goal_id
  ) THEN
    RAISE EXCEPTION 'cannot add same-goal product constraints: mismatched work_items, handoffs, or decisions exist; repair rows before retrying';
  END IF;
END;
$$;
--> statement-breakpoint
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "handoffs" DROP CONSTRAINT "handoffs_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_id_goal_id_unique" UNIQUE("id","goal_id");
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_product_goal_fk" FOREIGN KEY ("product_id","goal_id") REFERENCES "public"."products"("id","goal_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_product_goal_fk" FOREIGN KEY ("product_id","goal_id") REFERENCES "public"."products"("id","goal_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_product_goal_fk" FOREIGN KEY ("product_id","goal_id") REFERENCES "public"."products"("id","goal_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "decisions_product_goal_idx" ON "decisions" USING btree ("product_id","goal_id");
--> statement-breakpoint
CREATE INDEX "handoffs_product_goal_idx" ON "handoffs" USING btree ("product_id","goal_id");
--> statement-breakpoint
CREATE INDEX "work_items_product_goal_idx" ON "work_items" USING btree ("product_id","goal_id");
--> statement-breakpoint
DROP POLICY "users_own_rows" ON "users";
--> statement-breakpoint
CREATE POLICY "users_own_rows" ON "users" AS PERMISSIVE FOR SELECT TO public USING ((select auth.uid()) = "users"."auth_user_id");
--> statement-breakpoint
ALTER POLICY "decisions_own_rows" ON "decisions" TO public USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "decisions"."goal_id" and (select auth.uid()) = users.auth_user_id) and ("decisions"."product_id" is null or exists (select 1 from products where products.id = "decisions"."product_id" and products.goal_id = "decisions"."goal_id"))) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "decisions"."goal_id" and (select auth.uid()) = users.auth_user_id) and ("decisions"."product_id" is null or exists (select 1 from products where products.id = "decisions"."product_id" and products.goal_id = "decisions"."goal_id")));
--> statement-breakpoint
ALTER POLICY "evidence_own_rows" ON "evidence" TO public USING (exists (select 1 from products join goals on goals.id = products.goal_id join users on users.id = goals.owner_id where products.id = "evidence"."product_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from products join goals on goals.id = products.goal_id join users on users.id = goals.owner_id where products.id = "evidence"."product_id" and (select auth.uid()) = users.auth_user_id));
--> statement-breakpoint
ALTER POLICY "goals_own_rows" ON "goals" TO public USING (exists (select 1 from users where users.id = "goals"."owner_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from users where users.id = "goals"."owner_id" and (select auth.uid()) = users.auth_user_id));
--> statement-breakpoint
ALTER POLICY "handoffs_own_rows" ON "handoffs" TO public USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "handoffs"."goal_id" and (select auth.uid()) = users.auth_user_id) and ("handoffs"."product_id" is null or exists (select 1 from products where products.id = "handoffs"."product_id" and products.goal_id = "handoffs"."goal_id"))) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "handoffs"."goal_id" and (select auth.uid()) = users.auth_user_id) and ("handoffs"."product_id" is null or exists (select 1 from products where products.id = "handoffs"."product_id" and products.goal_id = "handoffs"."goal_id")));
--> statement-breakpoint
ALTER POLICY "products_own_rows" ON "products" TO public USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "products"."goal_id" and (select auth.uid()) = users.auth_user_id)) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "products"."goal_id" and (select auth.uid()) = users.auth_user_id));
--> statement-breakpoint
ALTER POLICY "work_items_own_rows" ON "work_items" TO public USING (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "work_items"."goal_id" and (select auth.uid()) = users.auth_user_id) and ("work_items"."product_id" is null or exists (select 1 from products where products.id = "work_items"."product_id" and products.goal_id = "work_items"."goal_id"))) WITH CHECK (exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = "work_items"."goal_id" and (select auth.uid()) = users.auth_user_id) and ("work_items"."product_id" is null or exists (select 1 from products where products.id = "work_items"."product_id" and products.goal_id = "work_items"."goal_id")));
