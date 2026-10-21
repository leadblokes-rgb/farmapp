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

In-app reporting arrives in **milestone 5** (chat). This section will then cover `admin_open_reports` and `admin_resolve_report()`.

---

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
