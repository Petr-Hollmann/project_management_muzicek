-- Trigger: notify admins when a new pending user registers
-- Requires pg_net extension (enable in Supabase Dashboard → Database → Extensions)
--
-- Before running this migration:
-- 1. Enable pg_net extension: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 2. Deploy the notify-pending-user Edge Function
-- 3. Set Supabase secrets: RESEND_API_KEY, NOTIFY_FROM_EMAIL
--
-- Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY below with actual values,
-- or use Supabase vault/secrets to store them.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_admins_on_pending_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  IF NEW.app_role = 'pending' THEN
    -- Read from Supabase project settings
    -- These are available as GUC variables in Supabase Edge Runtime
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);

    -- Fallback: if GUC vars not available, you can hardcode (not recommended for production)
    IF supabase_url IS NULL THEN
      RAISE WARNING 'app.settings.supabase_url not set — skipping pending user notification';
      RETURN NEW;
    END IF;

    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/notify-pending-user',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_name', COALESCE(NEW.full_name, NEW.email),
        'user_email', NEW.email
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Only fire on INSERT (new user registration), not on UPDATE
DROP TRIGGER IF EXISTS on_pending_user_insert ON public.users;
CREATE TRIGGER on_pending_user_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_pending_user();
