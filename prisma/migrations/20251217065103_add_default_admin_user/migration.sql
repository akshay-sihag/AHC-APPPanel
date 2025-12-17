-- Create default admin user
-- Username: akshaysihag
-- Password: Gsarena27ahcinc.df@856
-- Email: akshaysihag@alternatehealthclub.com

INSERT INTO "users" (
  "id",
  "email",
  "password",
  "name",
  "role",
  "isActive",
  "emailVerified",
  "loginCount",
  "createdAt",
  "updatedAt"
) VALUES (
  'cmj9nl7i1oqtn4s5ag2c',
  'akshaysihag@alternatehealthclub.com',
  '$2b$12$zbphxVAWc/eK3j02IzHTkebG5nq5Utn04mGEVCp.I4UGkD2wdHPVy',
  'akshaysihag',
  'ADMIN',
  true,
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;