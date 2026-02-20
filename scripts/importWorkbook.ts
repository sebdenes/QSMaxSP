import { PrismaClient } from "@prisma/client";
import { importWorkbookFromXlsx } from "../lib/importWorkbook";

function parseArg(name: string): string | null {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }
  const value = process.argv[index + 1];
  return value?.trim() ? value.trim() : null;
}

async function main() {
  const sourcePath = parseArg("--source") ?? process.env.WORKBOOK_PATH;
  if (!sourcePath) {
    throw new Error("Usage: npm run import:workbook -- --source /absolute/path/to/workbook.xlsx");
  }

  const prisma = new PrismaClient();
  const run = await prisma.importRun.create({
    data: {
      sourcePath,
      status: "RUNNING"
    }
  });

  try {
    const result = await importWorkbookFromXlsx(prisma, sourcePath);

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        message: `Imported workbook and synced domain tables from ${result.sourcePath}`,
        rowsDetected: result.sections,
        scenariosDetected: result.scenarios,
        servicesDetected: result.services,
        importedAt: new Date()
      }
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        message
      }
    });

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
