import { PrismaClient } from "@prisma/client";
import { DomainModel } from "./domainTypes";
import { getDomainModel } from "./domainStore";

export type DomainSyncSummary = {
  sections: number;
  services: number;
  scenarios: number;
  overrides: number;
};

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return null;
}

export async function syncDomainModel(
  prisma: PrismaClient,
  model: DomainModel
): Promise<DomainSyncSummary> {
  await prisma.scenarioServiceValue.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.service.deleteMany();
  await prisma.section.deleteMany();

  const sectionIdByName = new Map<string, number>();
  for (const section of model.sections) {
    const created = await prisma.section.create({
      data: {
        workbookRow: section.header_row,
        name: section.name,
        startRow: section.start_row,
        endRow: section.end_row,
        crmId: section.crm_id ?? null
      }
    });
    sectionIdByName.set(section.name, created.id);
  }

  const serviceIdByRow = new Map<number, number>();
  for (const service of model.service_items) {
    const sectionId = sectionIdByName.get(service.section);
    if (!sectionId) {
      continue;
    }

    const created = await prisma.service.create({
      data: {
        row: service.row,
        sectionId,
        name: service.service_name,
        crmId: service.crm_id ?? null,
        defaultEffort: toInt(service.default_effort),
        templateS: toInt(service.template_S),
        templateM: toInt(service.template_M),
        templateL: toInt(service.template_L),
        templateCustom: toInt(service.template_Custom),
        templateDetail: service.template_Details ?? null
      }
    });

    serviceIdByRow.set(service.row, created.id);
  }

  let overrideCount = 0;
  for (const scenario of model.scenarios) {
    const createdScenario = await prisma.scenario.create({
      data: {
        name: scenario.name,
        layout: scenario.totals_row2.layout,
        totalS: toInt(scenario.totals_row2.S),
        totalM: toInt(scenario.totals_row2.M),
        totalL: toInt(scenario.totals_row2.L),
        totalCustom: toInt(scenario.totals_row2.Custom),
        customTotalCell: scenario.totals_row2.custom_total_cell,
        overrideCount: scenario.override_count
      }
    });

    for (const override of scenario.overrides) {
      const serviceId = serviceIdByRow.get(override.row);
      if (!serviceId) {
        continue;
      }

      await prisma.scenarioServiceValue.create({
        data: {
          scenarioId: createdScenario.id,
          serviceId,
          s: toInt(override.changes.S),
          m: toInt(override.changes.M),
          l: toInt(override.changes.L),
          custom: toInt(override.changes.Custom),
          details: override.changes.Details ?? null
        }
      });

      overrideCount += 1;
    }
  }

  return {
    sections: model.sections.length,
    services: model.service_items.length,
    scenarios: model.scenarios.length,
    overrides: overrideCount
  };
}

export async function syncDomainModelFromFile(
  prisma: PrismaClient
): Promise<DomainSyncSummary> {
  const model = getDomainModel();
  return syncDomainModel(prisma, model);
}
