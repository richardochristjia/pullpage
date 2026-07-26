revoke catalog_editor, catalog_recovery_operator from postgres;
grant catalog_editor, catalog_recovery_operator to postgres
  with inherit false, set true;
