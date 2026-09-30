# Folio Resume Builder

A responsive, live resume editor with four visual templates and print-to-PDF export. Supabase provides Gmail OTP authentication, private per-user resume persistence, and private profile-photo storage.

## Run locally

Install dependencies with `npm install`, then start Vite with `npm run dev`.

## Connect Supabase

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase Project Settings → API. Use the Project URL, not the Supabase dashboard URL. The publishable/anon key is safe for frontend use when row-level security is enabled; never put a service-role key in this app.
2. In Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). This creates the `profiles` and `resumes` tables, owner-only row-level security policies, a private `profile-photos` bucket, and owner-only storage policies. A database trigger copies verified auth-user details into `profiles` on account creation/sign-in; existing users are backfilled when you run the script.
3. In Supabase Authentication → Providers → Email, enable email sign-in. In Authentication → Email Templates, make sure the sign-in/OTP template includes `{{ .Token }}` so users receive a six-digit code they can enter in the app.
4. Supabase's built-in email sender is rate-limited and intended for testing. Configure custom SMTP under Authentication → SMTP Settings for reliable code delivery.
5. In Supabase Authentication → URL Configuration, add the app origin to the allowed redirect URLs. For local Vite development, add `http://localhost:5173` and `http://127.0.0.1:5173`.
6. Restart Vite after changing `.env.local`. Users enter a Gmail address, receive a one-time code, and verify it in the app. Supabase then loads and autosaves their resume, stores their photo in private Storage, and continues to the print dialog when Download PDF was selected.

Resume and photo access is restricted to the signed-in owner by the SQL policies. The browser uses signed URLs for private photos. The UI restricts account addresses to `@gmail.com`. To see account details, open Supabase Table Editor → `profiles`; each row includes the auth user ID, email, email-confirmed time, display name, provider, and last sign-in time.