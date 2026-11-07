-- Kebijakan pembulatan jam lembur.
--
-- Pembulatan hanya memengaruhi jam yang diperhitungkan pada laporan/rekap.
-- Waktu absen aktual dan `attendances.duration_minutes` tetap disimpan sebagai
-- durasi aktual yang dibatasi jadwal SPKL. Aturan mulai berlaku berdasarkan
-- tanggal SPKL, sehingga bulan sebelumnya tidak berubah saat kebijakan diubah.
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS overtime_rounding_enabled boolean
    NOT NULL DEFAULT true;

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS overtime_rounding_tolerance_minutes integer
    NOT NULL DEFAULT 30
    CHECK (overtime_rounding_tolerance_minutes BETWEEN 0 AND 60);

-- Default bulan rekap terakhir agar rekap bulan sebelumnya langsung mengikuti
-- aturan baru. Super admin dapat memilih bulan lain melalui Pengaturan.
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS overtime_rounding_effective_month date
    NOT NULL DEFAULT (date_trunc('month', now() - interval '1 month'))::date;

CREATE OR REPLACE FUNCTION overtime_payable_minutes(
  p_duration_minutes integer,
  p_status text,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
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
  v_scheduled integer;
  v_shortfall integer;
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

  v_actual := GREATEST(
    0,
    ROUND(
      EXTRACT(
        EPOCH FROM (v_end - GREATEST(p_check_in_at, p_spkl_start_at))
      ) / 60
    )::integer
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
    ROUND(EXTRACT(EPOCH FROM (p_spkl_end_at - p_spkl_start_at)) / 60)::integer
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
