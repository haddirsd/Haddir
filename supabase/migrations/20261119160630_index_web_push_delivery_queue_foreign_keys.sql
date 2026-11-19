-- Cover queue foreign keys used by subscription ownership checks and retention cascades.
create index if not exists haddir_web_push_queue_subscription_idx
  on private.haddir_web_push_delivery_queue (subscription_id)
  where subscription_id is not null;

create index if not exists haddir_web_push_queue_user_idx
  on private.haddir_web_push_delivery_queue (user_id);
