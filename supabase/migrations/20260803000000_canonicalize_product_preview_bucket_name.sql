-- Keep the Storage bucket identifier and dashboard name identical so resumable uploads resolve it.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

update storage.buckets
set name = id
where id = 'product-previews'
  and name is distinct from id;
