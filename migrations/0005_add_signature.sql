-- Add signature columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url varchar(255);

-- Add signature columns to applications (in case you want to save the specific officer who signed it)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS signed_by integer REFERENCES users(id) ON DELETE SET NULL;