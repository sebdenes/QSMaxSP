import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { syncDomainModelFromFile } from "../lib/domainSync";

const prisma = new PrismaClient();

async function shouldSyncDomainModel(): Promise<boolean> {
  const [sectionCount, serviceCount, scenarioCount] = await Promise.all([
    prisma.section.count(),
    prisma.service.count(),
    prisma.scenario.count()
  ]);

  return sectionCount === 0 || serviceCount === 0 || scenarioCount === 0;
}

async function main() {
  if (await shouldSyncDomainModel()) {
    const summary = await syncDomainModelFromFile(prisma);
    console.log(
      `Domain model synced. sections=${summary.sections} services=${summary.services} scenarios=${summary.scenarios} overrides=${summary.overrides}`
    );
  } else {
    console.log("Domain model already present. Skipping sync.");
  }

  let user = await prisma.user.findUnique({ where: { email: "demo@quicksizer.local" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "demo@quicksizer.local",
        name: "Demo User",
        role: "ADMIN",
        passwordHash: hashPassword("demo1234")
      }
    });
  } else if (user.role !== "ADMIN") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" }
    });
  }

  const existingEngagements = await prisma.engagement.count({ where: { ownerId: user.id } });
  if (existingEngagements === 0) {
    await prisma.engagement.create({
      data: {
        ownerId: user.id,
        name: "Baseline Engagement",
        customerName: "Demo Customer",
        opportunity: "Prototype Validation",
        notes: "Initial seeded engagement",
        durationYears: 3
      }
    });
  }

  console.log("Seed completed.");
  console.log("Demo login: demo@quicksizer.local / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
