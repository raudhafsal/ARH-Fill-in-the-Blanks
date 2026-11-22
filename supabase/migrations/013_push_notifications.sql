-- Web push: subscriptions table, vault-backed config for the send-push edge function, and _notify() now also fires a push.
-- (Applied live. The VAPID private key and webhook secret were stored in the vault separately and are not in this file.)
-- See the deployed edge function "send-push".
create extension if not exists pg_net with schema extensions;
-- push_subscriptions (user_id, endpoint unique, p256dh, auth) with own-row RLS; push_config() for service_role;
-- _notify() calls net.http_post to /functions/v1/send-push inside an exception block.
