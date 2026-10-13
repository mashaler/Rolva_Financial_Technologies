-- Private storage for KYC documents. Run after schema.sql.
insert into storage.buckets (id, name, public) values ('kyc', 'kyc', false)
  on conflict (id) do nothing;

drop policy if exists kyc_read on storage.objects;
create policy kyc_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and public.rf_role() is not null);

drop policy if exists kyc_insert on storage.objects;
create policy kyc_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and public.rf_role() in ('owner','editor'));

drop policy if exists kyc_delete on storage.objects;
create policy kyc_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kyc' and public.rf_role() = 'owner');
