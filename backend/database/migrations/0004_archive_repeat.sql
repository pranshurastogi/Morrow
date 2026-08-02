ALTER TABLE scans
  ADD COLUMN source_scan_id uuid REFERENCES scans(id),
  ADD COLUMN initiation_source text NOT NULL DEFAULT 'capture'
    CHECK (initiation_source IN ('capture', 'archive_repeat'));

CREATE INDEX scans_source_scan_idx
  ON scans (source_scan_id)
  WHERE source_scan_id IS NOT NULL;
