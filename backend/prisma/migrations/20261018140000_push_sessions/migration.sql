-- Registrations from older versions must be renewed after login.
ALTER TABLE "PushDevice" ADD COLUMN "sessionId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "PushDevice" ALTER COLUMN "sessionId" DROP DEFAULT;
