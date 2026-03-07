ALTER TABLE "User" ADD COLUMN "cognitoSub" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'credentials';
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
CREATE UNIQUE INDEX "User_cognitoSub_key" ON "User"("cognitoSub");
