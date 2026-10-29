-- Role ketiga: administrator organisasi lintas tim. Super admin bukan atasan
-- operasional, jadi tidak boleh memiliki supervisor maupun divisi sendiri.
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
 CHECK (role IN ('pekerja','atasan','super_admin'));

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_super_admin_scope_check;
ALTER TABLE employees ADD CONSTRAINT employees_super_admin_scope_check
 CHECK (role <> 'super_admin' OR (supervisor_id IS NULL AND division_id IS NULL));
