import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo user
  const passwordHash = await hash("UNIRxHR2026!", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@unir.net" },
    update: { passwordHash },
    create: {
      email: "demo@unir.net",
      name: "Demo User",
      passwordHash,
      role: "admin",
    },
  });

  console.log("Created demo user:", demoUser.email);

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
