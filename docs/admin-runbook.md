# Croppr admin runbook (MVP)

For the MVP there is no separate admin app. Admin work happens in the **Supabase dashboard**:

- **Table Editor** for browsing data.
- **SQL Editor** for running the `admin_*` functions below.

Run every write through these functions, not by editing rows by hand. They enforce the rules and record each action in the `admin_actions` audit log.

> Locally the dashboard (Studio) is at http://127.0.0.1:54323. In production, use your project's dashboard at https://supabase.com/dashboard.

The admin functions **can't be called from the app**: execute permission is revoked from app users. They only run from the dashboard SQL editor or with the service-role key.

---

## 1. Approve or reject a farm

Every new farm starts as **pending**. Pending farms can't post jobs and aren't visible to workers. A farm also goes back to pending when:

- a verified farm changes its business name, ABN or labour hire details, or
- a rejected farm edits and resubmits its details.

### See the queue

```sql
select * from admin_pending_farms;   -- oldest first
```

### Checks for each farm

1. **ABN.** Search the ABN on [ABN Lookup](https://abr.business.gov.au/).
   - The ABN must be **Active**.
   - The entity or business name must reasonably match `business_name`.
   - The main business location should be consistent with the `postcode` (same state).
   - The app has already validated the ABN checksum, so a typo is unlikely; a mismatch is the thing to look for.
2. **Labour hire licence.** Do this only if `is_labour_hire` is true.
   - Search `labour_hire_licence_number` on the [Queensland labour hire licence register](https://www.labourhire.qld.gov.au/) (Labour Hire Licensing Queensland, public register search).
   - The licence must be **current** and held by the same business or ABN.
   - Labour hire providers operating in other states need that state's licence: Victoria has the Labour Hire Authority register, and SA has a register with Consumer and Business Services.
   - If the business supplies workers to other growers but said **no** to labour hire, reject it and ask them to declare it.
3. **Sense check.** The phone number should look plausible and the description shouldn't be spam. You can call the `contact_phone` if anything looks off.

### Approve

```sql
select admin_approve_farm('<farm_id>', 'ABN active, name matches; LHL licence current');
```

The farm owner sees the **Verified** badge next time the app loads their farm, and can post jobs.

### Reject

The reason is **shown to the farm in the app**, so write it for them:

```sql
select admin_reject_farm('<farm_id>', 'The business name doesn''t match the ABN on ABN Lookup. Please check and resubmit.');
```

(Escape apostrophes by doubling them: `''`.)

When the farm edits its details in the app, it goes back to pending and reappears in the queue.

---

## 2. Suspend or unsuspend a user

Suspending a user:

- blocks all data access through row-level security,
- shows them an "Account suspended" screen, and
- bans the auth user, so they can't sign in again or refresh their session.

Find the user's id from their email:

```sql
select id, email from auth.users where email ilike '%someone@example.com%';
```

Suspend or reinstate them:

```sql
select admin_suspend_user('<user_id>', 'Reported for no-shows on 3 jobs; see report #12');
select admin_unsuspend_user('<user_id>', 'Appeal accepted');
```

To suspend a whole farm business, suspend its owner (`farms.owner_id`).

---

## 3. Handle reports

Workers and farms can report the other person from any chat (flag icon), workers can report a job from its detail sheet, anyone can report a review, and workers can dispute a no-show. The person reported is **not** told. Reasons are: unsafe, underpaid, harassment, scam, no-show, fake profile, other, no-show dispute, inappropriate review.

### See the queue

```sql
select * from admin_open_reports;   -- oldest first
```

| Column | What it tells you |
|---|---|
| `reporter_email`, `reporter_role` | Who reported |
| `target_email`, `target_role`, `target_status` | Who was reported, and whether they're already suspended |
| `job_title`, `farm_name` | The job involved, if any |
| `reports_against_target` | How many reports this person has in total; repeated reports matter most |
| `conversation_id` | The chat the report came from, if any |

To read a chat (only when a report needs it), run:

```sql
select sender_id, body, created_at from messages where conversation_id = '<conversation_id>' order by created_at;
```

### Decide

- **Unsafe / scam / harassment.** Act fast. Suspend the target (section 2), then resolve:
  ```sql
  select admin_suspend_user('<target_user_id>', 'Report #12: asked workers for a bond payment');
  select admin_resolve_report(12, 'actioned', 'Suspended farm owner');
  ```
- **Underpaid.** Check the job's pay (`select pay_type, pay_rate_cents, min_hourly_guarantee_cents from jobs where id = '<target_job_id>'`). Contact the farm. Point workers to the Fair Work Ombudsman (13 13 94). Suspend if it's repeated.
- **No-show** (reported from a chat). Usually just record it: `admin_resolve_report(<id>, 'actioned', 'Noted no-show')`. Farms now mark no-shows on the check-in screen, which counts against the worker automatically.
- **No-show dispute** (`reason = 'no_show_dispute'`). A worker says a farm wrongly marked them as a no-show. While it's open, the no-show doesn't count against them. Read `details` and, if needed, the chat (`conversation_id`), or call the farm. Then decide:
  ```sql
  -- The worker did turn up: the no-show is removed and their job completes normally.
  select admin_resolve_no_show_dispute(<report_id>, 'overturned', 'Supervisor confirmed they worked');
  -- The no-show stands and counts against the worker.
  select admin_resolve_no_show_dispute(<report_id>, 'upheld', 'Farm sign-in sheet shows absent');
  ```
  The worker sees the outcome in the app.
- **Inappropriate review** (`reason = 'inappropriate_review'`). `review_comment` shows the text and `review_kind` says whether it's a review of a farm or of a worker. Hide reviews that are abusive, share private details, or are clearly false:
  ```sql
  select admin_hide_review('<review_kind>', '<review_application_id>', 'Abusive language');
  select admin_resolve_report(<report_id>, 'actioned', 'Review hidden');
  ```
  A hidden review disappears from the app and from averages. Otherwise dismiss the report.
- **Not a real problem:**
  ```sql
  select admin_resolve_report(12, 'dismissed', 'Misunderstanding about start time');
  ```

Every resolution is recorded in `admin_actions`.

---

## 3b. People sharing contact details before a hire

Until a farm accepts a worker, Croppr hides phone numbers, emails, links and social handles in their chat (shown as `#####`). The original text is kept for admins only:

```sql
select * from admin_contact_share_attempts;   -- per person, last 30 days, most attempts first
```

One or two attempts are usually innocent. A farm that keeps trying across many workers is trying to hire off Croppr: send a warning, and suspend it if it carries on (section 2). The filter catches most attempts but not all; tricks like writing digits as emoji get through, so treat this list as a signal rather than proof.

## 3c. Specified-work postcode lists

The eligible postcode lists (plant & animal cultivation, one per visa subclass) are in the database. See what's current:

```sql
select id, visa_subclass, version, last_checked, source_url, needs_expert_review
from specified_work_lists where is_current;
```

**Checked against Home Affairs and nothing changed:**

```sql
update specified_work_lists set last_checked = current_date where is_current;
```

**The list changed:** load the new version, check it, then switch over. Jobs and tracker employers are re-tagged automatically.

```sql
-- 1. Add the new version (not current yet). Repeat for 462 if it changed too.
insert into specified_work_lists (category, visa_subclass, label, version, last_checked, source_url, needs_expert_review)
values ('plant_animal_cultivation', '417', 'plant & animal cultivation', '2027-03', current_date,
        'https://www.legislation.gov.au/...', false)
returning id;

-- 2. Its postcode ranges (one row per range; a single postcode is from = to).
insert into specified_work_postcodes (list_id, postcode_from, postcode_to) values
  (<new id>, 2311, 2312),
  (<new id>, 2328, 2411);  -- … and so on

-- 3. Spot-check, then make it current.
select public.specified_work_label('4343', 'picking', '417');
select admin_activate_specified_work_list(<new id>, 'Updated from LIN 22/037 compilation of March 2027');
```

Old versions are kept for the record.

## 4. Make someone an admin

App admins aren't needed for the MVP, because dashboard access is what matters. If you need one, for example for the future admin app:

```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'person@croppr.example');
```

Users can't make themselves admins from the app; database tests cover this.

---

## 5. Audit log

```sql
select * from admin_actions order by created_at desc limit 50;
```

`performed_by` records the database user that ran the action. In the dashboard, that's `postgres`. Put your name or initials in the note when several people share admin duties.

---

## 6. Privacy reminders

- `worker_private` holds nationality, visa type and visa expiry. Only open it when you need to, for example to investigate a report.
- Worker photos are in the **private** `avatars` bucket. Don't make it public.
- Users can delete their own account from the app. That deletes their auth user, and their profile, visa details and farm cascade with it. To delete a user on request instead, use **Authentication → Users → Delete user** in the dashboard.
