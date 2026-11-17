-- Keep exactly one active gate ticket per booking item.
-- Prefer an already-used code; otherwise keep the earliest issued code.
with ranked as (
  select
    id,
    row_number() over (
      partition by booking_item_id
      order by
        case when status = 'used' then 0 else 1 end,
        issued_at asc,
        id asc
    ) as rn
  from public.tickets
  where booking_item_id is not null
    and status in ('valid','used')
)
update public.tickets t
set status = 'cancelled'
from ranked r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists tickets_one_active_per_booking_item_uidx
  on public.tickets (booking_item_id)
  where booking_item_id is not null and status in ('valid','used');