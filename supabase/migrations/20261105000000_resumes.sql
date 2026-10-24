-- Workers can attach their resume (PDF, Word or a photo). Private: only the worker, farms they've
-- applied to, and admins can open it.

alter table public.worker_profiles
  add column resume_path text,
  add column resume_name text check (char_length(resume_name) <= 120);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resumes', 'resumes', false, 5242880, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic'
  ]);

create policy "resumes: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resumes: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active());
create policy "resumes: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resumes: farm reads applicants" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.is_my_applicant_folder((storage.foldername(name))[1]));
create policy "resumes: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.is_admin());
