-- Piket hari Sabtu.
--
-- `piket_start_at` menyimpan batas mulai hitung lembur piket (Sabtu pukul
-- 12.00 waktu setempat saat check-in). Waktu absen aktual tetap disimpan pada
-- `check_in_at`; durasi dan rekap memakai batas ini agar absen pagi tidak
-- dihitung sebagai lembur piket.
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS piket_start_at timestamptz;

COMMENT ON COLUMN attendances.piket_start_at IS
  'Batas mulai hitung lembur piket hari Sabtu; null untuk sesi biasa.';

-- Fungsi lama tidak mengetahui batas piket. Hapus signature lama agar tidak
-- ada overload yang terpanggil tanpa parameter piket.
DROP FUNCTION IF EXISTS overtime_payable_minutes(
  integer,text,timestamptz,timestamptz,timestamptz,timestamptz,date,timestamptz,timestamptz
);

CREATE OR REPLACE FUNCTION overtime_payable_minutes(
  p_duration_minutes integer,
  p_status text,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_piket_start_at timestamptz,
  p_spkl_start_at timestamptz,
  p_spkl_end_at timestamptz,
  p_spkl_date date,
  p_spkl_canceled_at timestamptz,
  p_now timestamptz
) RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_enabled boolean;
  v_tolerance integer;
  v_effective_month date;
  v_actual integer;
  v_scheduled_start timestamptz;
  v_scheduled integer;
  v_shortfall integer;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF p_status = 'tidak_hadir' THEN
    RETURN 0;
  END IF;

  IF p_check_in_at IS NULL THEN
    RETURN GREATEST(0, COALESCE(p_duration_minutes, 0));
  END IF;

  IF p_check_out_at IS NULL THEN
    -- Sesi yang sudah final tanpa checkout tidak boleh mendapat jam penuh.
    IF p_status <> 'berjalan' THEN
      RETURN 0;
    END IF;
    v_end := LEAST(p_now, p_spkl_end_at);
  ELSE
    v_end := LEAST(p_check_out_at, p_spkl_end_at);
  END IF;

  -- Piket hanya dihitung sejak batas piket. Untuk sesi biasa, batas ini null
  -- sehingga perhitungan tetap dimulai dari jadwal SPKL.
  v_scheduled_start := GREATEST(
    p_spkl_start_at,
    COALESCE(p_piket_start_at, p_spkl_start_at)
  );
  v_start := GREATEST(p_check_in_at, v_scheduled_start);

  v_actual := GREATEST(
    0,
    ROUND(EXTRACT(EPOCH FROM (v_end - v_start)) / 60)::integer
  );

  -- Sesi berjalan, SPKL batal, dan sesi tanpa checkout tidak dibulatkan.
  IF p_check_out_at IS NULL OR p_spkl_canceled_at IS NOT NULL THEN
    RETURN v_actual;
  END IF;

  SELECT
    overtime_rounding_enabled,
    overtime_rounding_tolerance_minutes,
    overtime_rounding_effective_month
  INTO v_enabled, v_tolerance, v_effective_month
  FROM policies
  WHERE id = 'policy';

  IF NOT FOUND
    OR NOT COALESCE(v_enabled, false)
    OR p_spkl_date < v_effective_month
  THEN
    RETURN v_actual;
  END IF;

  v_scheduled := GREATEST(
    0,
    ROUND(EXTRACT(EPOCH FROM (p_spkl_end_at - v_scheduled_start)) / 60)::integer
  );
  v_shortfall := GREATEST(0, v_scheduled - v_actual);

  IF v_shortfall <= v_tolerance THEN
    RETURN v_scheduled;
  END IF;

  RETURN GREATEST(
    0,
    v_scheduled - CEIL((v_shortfall - v_tolerance) / 60.0)::integer * 60
  );
END;
$$;
