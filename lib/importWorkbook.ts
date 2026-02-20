import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { getDomainModel } from "./domainStore";
import { syncDomainModel } from "./domainSync";

export type WorkbookImportResult = {
  sourcePath: string;
  outputDir: string;
  sections: number;
  services: number;
  scenarios: number;
  overrides: number;
};

export async function importWorkbookFromXlsx(
  prisma: PrismaClient,
  sourcePath: string
): Promise<WorkbookImportResult> {
  const resolvedSource = path.resolve(sourcePath);
  const projectRoot = process.cwd();

  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Workbook not found: ${resolvedSource}`);
  }

  const outputDir = path.join(projectRoot, "data");
  const analysisDir = path.join(projectRoot, "analysis", "prototype4");
  const parserScript = path.join(projectRoot, "scripts", "import_workbook.py");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        parserScript,
        "--input",
        resolvedSource,
        "--output-dir",
        outputDir,
        "--analysis-dir",
        analysisDir
      ],
      {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Workbook import parser failed with code ${code}.`));
      }
    });
  });

  const model = getDomainModel();
  const summary = await syncDomainModel(prisma, model);

  return {
    sourcePath: resolvedSource,
    outputDir,
    sections: summary.sections,
    services: summary.services,
    scenarios: summary.scenarios,
    overrides: summary.overrides
  };
}
