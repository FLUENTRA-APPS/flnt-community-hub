
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles select own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles select own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- admin allowlist (server-side only)
CREATE TABLE public.admin_allowlist (
  email text PRIMARY KEY
);
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_allowlist (email) VALUES ('ahmedalihusnain0@gmail.com');

-- ============ EMAIL CODES ============
CREATE TABLE public.email_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup','login')),
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_codes TO service_role;
ALTER TABLE public.email_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX email_codes_lookup ON public.email_codes (email, purpose, created_at DESC);

-- ============ POLLS ============
CREATE OR REPLACE FUNCTION public.gen_poll_code() RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE c text; BEGIN
  LOOP
    c := lpad((floor(random()*9000000000)+1000000000)::bigint::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.polls WHERE code = c);
  END LOOP;
  RETURN c;
END; $$;

CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{10}$'),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  author_display_name text NOT NULL CHECK (char_length(author_display_name) BETWEEN 1 AND 80),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  explanation text NOT NULL CHECK (char_length(explanation) BETWEEN 10 AND 5000),
  yes_count int NOT NULL DEFAULT 0,
  no_count int NOT NULL DEFAULT 0,
  milestone_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.polls TO anon;
GRANT SELECT, INSERT ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls public read" ON public.polls FOR SELECT USING (true);
CREATE POLICY "polls insert own" ON public.polls FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- private author email
CREATE TABLE public.poll_private (
  poll_id uuid PRIMARY KEY REFERENCES public.polls(id) ON DELETE CASCADE,
  author_email text NOT NULL
);
GRANT SELECT, INSERT ON public.poll_private TO authenticated;
GRANT ALL ON public.poll_private TO service_role;
ALTER TABLE public.poll_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_private owner/admin read" ON public.poll_private FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.owner_id = auth.uid()));
CREATE POLICY "poll_private owner insert" ON public.poll_private FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.owner_id = auth.uid()));

CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes read own" ON public.poll_votes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "votes insert own" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes update own" ON public.poll_votes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_poll_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.polls p SET
    yes_count = (SELECT count(*) FROM public.poll_votes v WHERE v.poll_id = p.id AND v.choice),
    no_count  = (SELECT count(*) FROM public.poll_votes v WHERE v.poll_id = p.id AND NOT v.choice)
  WHERE p.id = COALESCE(NEW.poll_id, OLD.poll_id);
  RETURN NULL;
END; $$;
CREATE TRIGGER poll_votes_sync AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_poll_counts();

CREATE TABLE public.poll_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.poll_comments(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.poll_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.poll_comments TO authenticated;
GRANT ALL ON public.poll_comments TO service_role;
ALTER TABLE public.poll_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments public read" ON public.poll_comments FOR SELECT USING (true);
CREATE POLICY "comments insert own" ON public.poll_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments delete own/admin" ON public.poll_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ TRUST DIRECTORY ============
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,15}$'),
  seller_name text NOT NULL CHECK (char_length(seller_name) BETWEEN 2 AND 80),
  business_type text NOT NULL CHECK (char_length(business_type) BETWEEN 2 AND 60),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_override boolean,
  adjust_count int NOT NULL DEFAULT 0,
  adjust_sum numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses public read" ON public.businesses FOR SELECT USING (true);
CREATE POLICY "businesses insert own" ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.business_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  stars numeric(2,1) NOT NULL CHECK (stars >= 0.5 AND stars <= 5 AND (stars * 2) = floor(stars * 2)),
  review text NOT NULL DEFAULT '' CHECK (char_length(review) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_ratings TO anon;
GRANT SELECT, INSERT ON public.business_ratings TO authenticated;
GRANT ALL ON public.business_ratings TO service_role;
ALTER TABLE public.business_ratings ENABLE ROW LEVEL SECURITY;
CREATE INDEX business_ratings_recent ON public.business_ratings (business_id, user_id, created_at DESC);
CREATE POLICY "ratings public read" ON public.business_ratings FOR SELECT USING (true);
CREATE POLICY "ratings insert own" ON public.business_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- server-side 24h duplicate protection
CREATE OR REPLACE FUNCTION public.enforce_rating_cooldown() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.business_ratings r
             WHERE r.business_id = NEW.business_id AND r.user_id = NEW.user_id
               AND r.created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'You can only rate this business once every 24 hours';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER business_ratings_cooldown BEFORE INSERT ON public.business_ratings
FOR EACH ROW EXECUTE FUNCTION public.enforce_rating_cooldown();

CREATE OR REPLACE VIEW public.business_stats
WITH (security_invoker = true) AS
SELECT b.id,
  b.slug, b.seller_name, b.business_type, b.created_at,
  b.adjust_count, b.adjust_sum, b.badge_override,
  COALESCE(count(r.id), 0)::int AS organic_count,
  COALESCE(round(avg(r.stars)::numeric, 2), 0) AS organic_avg,
  (COALESCE(count(r.id),0) + b.adjust_count)::int AS total_count,
  CASE WHEN (COALESCE(count(r.id),0) + b.adjust_count) > 0
    THEN round(((COALESCE(sum(r.stars),0) + b.adjust_sum) / (COALESCE(count(r.id),0) + b.adjust_count))::numeric, 2)
    ELSE 0 END AS total_avg,
  COALESCE(b.badge_override,
    (COALESCE(count(r.id),0) + b.adjust_count) >= 5000
    AND CASE WHEN (COALESCE(count(r.id),0) + b.adjust_count) > 0
      THEN ((COALESCE(sum(r.stars),0) + b.adjust_sum) / (COALESCE(count(r.id),0) + b.adjust_count))
      ELSE 0 END > 2.5) AS verified
FROM public.businesses b
LEFT JOIN public.business_ratings r ON r.business_id = b.id
GROUP BY b.id;
GRANT SELECT ON public.business_stats TO anon, authenticated, service_role;

-- ============ SUPPORT ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX one_open_ticket_per_user ON public.support_tickets (user_id) WHERE status = 'open';
CREATE POLICY "tickets own/admin read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tickets insert own" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket messages read" ON public.ticket_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "ticket messages insert" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status = 'open')));

-- ============ AUDIT LOG ============
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  prior_value jsonb,
  new_value jsonb,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
