
ALTER TABLE public.profiles
  ADD COLUMN mfa_ok_until timestamptz,
  ADD COLUMN last_login_at timestamptz;
