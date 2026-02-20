import { PrismaClient } from "@prisma/client";
import { getVisibilityData } from "./domainStore";

type EffectiveValue = number | null;

function numberOrNull(value: number | null | undefined): EffectiveValue {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export async function getScenarioDrilldown(
  prisma: PrismaClient,
  scenarioId: number
): Promise<{
  scenario: {
    id: number;
    name: string;
    layout: string;
    totalS: number | null;
    totalM: number | null;
    totalL: number | null;
    totalCustom: number | null;
    overrideCount: number;
  };
  sections: Array<{
    id: number;
    workbookRow: number;
    name: string;
    totals: {
      S: number;
      M: number;
      L: number;
      Custom: number;
    };
    visibleTotals: {
      S: number;
      M: number;
      L: number;
      Custom: number;
    };
    services: Array<{
      id: number;
      row: number;
      name: string;
      crmId: string | null;
      defaultEffort: number | null;
      visible: boolean;
      template: {
        S: number | null;
        M: number | null;
        L: number | null;
        Custom: number | null;
        Details: string | null;
      };
      effective: {
        S: number | null;
        M: number | null;
        L: number | null;
        Custom: number | null;
        Details: string | null;
      };
      overrides: {
        S: boolean;
        M: boolean;
        L: boolean;
        Custom: boolean;
        Details: boolean;
      };
    }>;
  }>;
} | null> {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId }
  });

  if (!scenario) {
    return null;
  }

  const sections = await prisma.section.findMany({
    orderBy: { workbookRow: "asc" },
    include: {
      services: {
        orderBy: { row: "asc" },
        include: {
          values: {
            where: { scenarioId }
          }
        }
      }
    }
  });

  const visibility = getVisibilityData().find((entry) => entry.name === scenario.name);
  const hiddenRows = new Set<number>(visibility?.hidden_rows_sorted ?? []);

  const sectionResults = sections.map((section) => {
    const services = section.services.map((service) => {
      const override = service.values[0];

      const template = {
        S: numberOrNull(service.templateS),
        M: numberOrNull(service.templateM),
        L: numberOrNull(service.templateL),
        Custom: numberOrNull(service.templateCustom),
        Details: service.templateDetail
      };

      const effective = {
        S:
          override && override.s !== null
            ? numberOrNull(override.s)
            : numberOrNull(service.templateS),
        M:
          override && override.m !== null
            ? numberOrNull(override.m)
            : numberOrNull(service.templateM),
        L:
          override && override.l !== null
            ? numberOrNull(override.l)
            : numberOrNull(service.templateL),
        Custom:
          override && override.custom !== null
            ? numberOrNull(override.custom)
            : numberOrNull(service.templateCustom),
        Details:
          override && override.details !== null ? override.details : service.templateDetail
      };

      const overrides = {
        S: Boolean(override && override.s !== null),
        M: Boolean(override && override.m !== null),
        L: Boolean(override && override.l !== null),
        Custom: Boolean(override && override.custom !== null),
        Details: Boolean(override && override.details !== null)
      };

      return {
        id: service.id,
        row: service.row,
        name: service.name,
        crmId: service.crmId,
        defaultEffort: numberOrNull(service.defaultEffort),
        visible: !hiddenRows.has(service.row),
        template,
        effective,
        overrides
      };
    });

    const totals = services.reduce(
      (acc, service) => {
        acc.S += service.effective.S ?? 0;
        acc.M += service.effective.M ?? 0;
        acc.L += service.effective.L ?? 0;
        acc.Custom += service.effective.Custom ?? 0;
        return acc;
      },
      { S: 0, M: 0, L: 0, Custom: 0 }
    );

    const visibleTotals = services.reduce(
      (acc, service) => {
        if (!service.visible) {
          return acc;
        }
        acc.S += service.effective.S ?? 0;
        acc.M += service.effective.M ?? 0;
        acc.L += service.effective.L ?? 0;
        acc.Custom += service.effective.Custom ?? 0;
        return acc;
      },
      { S: 0, M: 0, L: 0, Custom: 0 }
    );

    return {
      id: section.id,
      workbookRow: section.workbookRow,
      name: section.name,
      totals,
      visibleTotals,
      services
    };
  });

  return {
    scenario: {
      id: scenario.id,
      name: scenario.name,
      layout: scenario.layout,
      totalS: numberOrNull(scenario.totalS),
      totalM: numberOrNull(scenario.totalM),
      totalL: numberOrNull(scenario.totalL),
      totalCustom: numberOrNull(scenario.totalCustom),
      overrideCount: scenario.overrideCount
    },
    sections: sectionResults
  };
}
