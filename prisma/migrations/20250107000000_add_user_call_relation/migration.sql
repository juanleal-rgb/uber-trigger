-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE INDEX "calls_user_id_idx" ON "calls"("user_id");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
