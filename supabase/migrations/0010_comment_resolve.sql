-- Allow any diagram member to resolve/reopen comments via RPC.
-- Direct UPDATE is still restricted to author/owner; resolve uses this path.

create or replace function public.resolve_diagram_comment(
  comment_id uuid,
  is_resolved boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d_id uuid;
begin
  select diagram_id into d_id
  from public.diagram_comments
  where id = comment_id;

  if d_id is null then
    raise exception 'Comment not found';
  end if;

  if not public.is_diagram_accessible(d_id) then
    raise exception 'Not authorized';
  end if;

  update public.diagram_comments
    set resolved = is_resolved
    where id = comment_id;
end;
$$;

grant execute on function public.resolve_diagram_comment(uuid, boolean) to authenticated;
