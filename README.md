# Rolva Finance Technologies website

Visitors see the business website and the loan application form. Staff sign in at `/admin/` and get the loan manager.
(If a signed-in staff member opens the home page, they are sent straight to the manager.)

## What is in this folder
- `index.html` – public website and application form
- `admin/index.html` – staff login
- `admin/manager.html` – the loan manager (needs login)
- `admin/claude-shim.js` – connects the manager to your database
- `config.js` – your settings (Supabase keys, business details)
- `supabase/schema.sql`, `supabase/storage.sql` – database setup and security rules

## Setup (about 20 minutes)
1. Create a free project at supabase.com.
2. **SQL Editor:** paste and run `supabase/schema.sql`, then `supabase/storage.sql`.
3. **Authentication > Providers > Email:** turn OFF "Allow new users to sign up". Staff accounts are created by you only.
4. **Authentication > Users > Add user:** create your login (email and password).
5. Make yourself the owner. In the SQL Editor run (use your email):
   ```sql
   insert into public.admins (user_id, role, name)
   select id, 'owner', 'Your name' from auth.users where email = 'you@example.com';
   ```
6. **Project Settings > API:** copy the Project URL and the `anon` public key into `config.js`. Also fill in your phone, email, WhatsApp number and NCR registration number. Never use the `service_role` key.
7. Upload the whole folder to a static host (Netlify, Cloudflare Pages or GitHub Pages) and point your domain at it. It must be served over https.
8. Test: submit an application on the home page, then sign in at `/admin/`. It should appear under Applications.

## Adding staff
Create the user in Authentication > Users, then add a row to `admins` with a role:
- `owner`: everything, including deleting loans, waiving fees, closing months, restoring backups
- `editor`: add loans, roll over, import bank statements, reports, KYC uploads, approve applications
- `contributor`: record payments, collections log, reminders, add applications
- `viewer`: read-only (cannot see the audit trail)

The database enforces who can read, create, change and delete each kind of record. The finer limits inside a record (for example a contributor not being able to waive a fee) are enforced by the page only.

## Moving your existing loans in
In the claude.ai version click **Backup**. On the website, sign in as owner and use **Restore from backup** with that file. KYC file uploads are not in the backup and must be uploaded again.

## Before you go live
- Add your NCR registration number in `config.js`.
- Add a privacy policy page and appoint an information officer (POPIA). The form already asks for consent.
- The application form is limited to 20 submissions a minute and has a hidden bot trap. If you get spam, add a CAPTCHA (Cloudflare Turnstile is free).
- Supabase backups: the free plan has none. Use the in-app **Backup** button regularly.
- The pages load supabase-js 2.45.4 from jsDelivr. You can upgrade the version number in the three `<script>` tags later.
# Rolva_Financial_Technologies
