# Student Management · কোচিং ব্যবস্থাপনা

A phone-first web app for coaching centres, in Bangla and English. Many centres can use one app, and each centre's data is completely separate. You are the **super admin**: you approve centres, and you can only look at a centre's data when its owner turns on support access.

| Who | What they get |
|---|---|
| **Super admin (you)** | Approve, pause and reactivate centres. A read-only support view, only while the owner allows it (ends automatically after 3 days) |
| **Centre owner** | Everything: attendance, cash fees, students, exams, admission requests, batches & fees, staff, settings |
| **Staff** | Only the sections the owner ticks (attendance / exams / fees / students), and only for the batches assigned to them |
| **Students & guardians** | A public admission page with course details and a short request form. No login |

### Features
- **Batches & fees:**
  - Name, label (HSC 28 / SSC 27), course start and end dates.
  - Subjects, each with class days and time.
  - A fee table by number of subjects (monthly, plus an optional full-course fee).
  - Exam types for the batch.
  - A **Show on admission page** switch and a note for students.
  - A **Seat full** switch for each subject. When every subject is full, the page shows the whole batch as full.
- **Students:**
  1. Pick the batch.
  2. Tick the subjects the student takes.
  3. The fee fills in from the fee table, and can be edited.

  Monthly fees run from the admission date: 15 Jan → 15 Jan–14 Feb, and so on. If a monthly fee changes, the new fee applies from the next cycle.
- **Attendance:** one class = one subject on one day.
  1. Tap "Class happened". Everyone who takes that subject is marked present.
  2. Tap the absent students. It saves by itself.
  3. You can send a WhatsApp message to the guardian.
- **Fees (cash):**
  - Collecting a fee: choose the student, then the number of months, then Receive. A WhatsApp receipt is ready to send.
  - The fees page shows dues, reminders, the month's collection against its target, and totals by batch.
- **Exams:**
  - Each exam has a type, subject and topic.
  - It can have MCQ only, Written only, or both, each with its own pass mark. Leave the pass mark empty for the BD rule (33%).
  - Results show total, %, BD grade (A+ to F), GPA and rank. Failing any part gives an F.
  - There's a top-3 podium, and students can be marked absent.
- **Admission page** (`enroll.html?c=your-link`):
  - Course details built from your batches.
  - A form with: name ✱, phone ✱, WhatsApp number or username, school/college, guardian phone ✱, and "কোন ব্যাচ, কোন কোন বিষয়ে পড়তে চান?" (which batch and subjects).
  - Requests arrive in the app. **Make student** fills in the details for you.
- **Settings:**
  - Bangla/English, Light/Dark/Auto mode, 10 colours, 3+3 fonts.
  - **In-app or phone date/time picker.**
  - Logo, admission link, support access.

---

## 1. Create the Supabase project
1. Go to https://supabase.com and create a **New project**. A region close to Bangladesh, such as Singapore, is best.
2. Open **SQL Editor → New query** and run these files, one at a time, in this order:
   - **`sql/01_schema.sql`**: the whole database and its security rules.
   - **`sql/02_storage.sql`**: storage for centre logos.

   If you already ran the **Phase 1** version earlier, run **`sql/upgrade_from_phase1.sql`** instead of `01_schema.sql`. It's safe to run more than once.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public key** into **`js/config.js`**.

## 2. Login settings
**Authentication → URL Configuration**
- **Site URL**: your app address, e.g. `https://yourname.github.io/student-management/`
- **Redirect URLs**: add the same address. Password-reset and confirm-email links return here.

**Authentication → Providers → Email**
- Keep **Confirm email** ON.
- Supabase's built-in email sender only allows a few emails per hour. Before real centres join, set up **Authentication → SMTP Settings** with an email service, e.g. Brevo, Resend or Gmail SMTP.

## 3. Put it online (GitHub Pages)
1. Create a GitHub repository (e.g. `student-management`) and upload **all files** in this folder, keeping the folders as they are.
2. Go to **Settings → Pages → Deploy from a branch**, choose `main` / root, and save.
3. About a minute later, the app is live at `https://<username>.github.io/student-management/`.

There's no build step: the files run as they are. Netlify, Vercel or Cloudflare Pages also work if you drag the folder in.

## 4. Make yourself super admin
1. Open the app → **Register → I was added as staff**, and register with **your own email**. Confirm the email.
2. In the SQL Editor, open **`sql/03_make_super_admin.sql`**, put your email in it, and run it.
3. Log in again. You'll see **All coaching centres**.

## 5. Start with your friend
1. Your friend: **Register → Register a coaching centre**. He'll see "Waiting for approval".
2. You: open the **Pending** tab and tap **Approve**.
3. Your friend: log in, then **Start here → New batch**. For each batch, add the subjects, days and times, the fee table, exam types, and the admission-page switches.
4. Add students: **+ → New student**.
5. Share the admission link from **Settings → Admission link**.
6. To install it like an app on a phone: open it in Chrome, then **⋮ → Add to Home screen**.

## Tips
- **If a date or time doesn't save on a phone:** go to Settings → Date & time picker and choose **In-app** (the default). Every Save button reads the boxes directly, so Bangla keyboards are safe.
- **Staff:**
  1. The owner goes to **⋯ → Staff → Add staff**, enters the email, ticks what they can do and picks their batches.
  2. The staff member registers with that email, choosing "I was added as staff".
  3. They're linked automatically.
- **Support access:** the owner taps **Settings → Support access → Allow for 3 days**. After 3 days it switches off by itself, and you can only view, not change.
- **Backups:** Supabase free projects pause after a period of no use, and free plans don't keep long backups. Upgrade before you rely on it for real money records, or export your data regularly from **Database → Backups / Table editor → Export**.

## How security works
- Every row of every table carries the centre's id, and **Row Level Security** in the database lets each user see only their own centre's rows. This holds even if someone edits the app's code.
- New centres stay **pending** and can't add data until you approve them.
- Owners can't change their own status or support time, and nobody can make themselves super admin from the app.
- Staff can't see fees unless the owner ticks "Fees & payments", and they only see their assigned batches.
- The admission page can only read what each centre chooses to show, and can only send requests. Phone numbers are checked, and repeat requests from the same number are limited.
- 49 database security tests passed, covering two centres, a super admin, staff, the public page and support expiry.

## Files
```
index.html                 the app
enroll.html                public admission page (?c=link-name)
css/app.css                styles (light/dark)
js/config.js               ← your Supabase URL + anon key
js/main.js                 start-up, login state, navigation
js/store.js  js/logic.js   data loading, permissions, fee cycles, exam grading
js/i18n.js   js/dates.js   Bangla/English text, dates, times
js/ui.js                   buttons, sheets, theme, in-app date & time pickers
js/enroll.js               public admission page
js/views/*.js              screens: auth, super, home, attend, fees, students, exams, requests, batches, staff, settings
sql/01_schema.sql          full database + security rules (fresh install)
sql/02_storage.sql         logo storage
sql/03_make_super_admin.sql
sql/upgrade_from_phase1.sql only if you installed the Phase 1 database before
```

Later, if needed: bKash payments, premium plans (a hidden switch is already in the database), SMS.
