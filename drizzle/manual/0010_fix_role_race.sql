CREATE OR REPLACE FUNCTION public.set_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := public.current_user_id();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 1. Lock the workspace first to prevent race conditions
  PERFORM 1 FROM public.workspaces w WHERE w.id = p_workspace_id FOR UPDATE;

  -- 2. Now safely check ownership
  IF NOT public.is_workspace_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'only an active workspace owner may change member roles'
      USING ERRCODE = '42501';
  END IF;

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'workspace role is required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace member not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workspace_members
  SET role = p_role
  WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_workspace_member_role(uuid, uuid, public.workspace_role) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_role(uuid, uuid, public.workspace_role) TO app_user;
