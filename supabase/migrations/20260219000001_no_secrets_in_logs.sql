-- Enforce no obvious secret patterns in log/telemetry columns
ALTER TABLE armageddon_events
  ADD CONSTRAINT chk_no_secret_pattern_message
  CHECK (message !~ '(?i)(password|secret|token|api_key|apikey)');

ALTER TABLE armageddon_events
  ADD CONSTRAINT chk_no_secret_pattern_payload
  CHECK (payload::text !~ '(?i)(password|secret|token|api_key|apikey)');
