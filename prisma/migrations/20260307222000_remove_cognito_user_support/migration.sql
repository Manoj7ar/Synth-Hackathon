DROP INDEX IF EXISTS "User_cognitoSub_key";

ALTER TABLE "User" DROP COLUMN IF EXISTS "cognitoSub";
