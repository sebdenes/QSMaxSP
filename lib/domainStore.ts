import fs from "node:fs";
import path from "node:path";
import { getProjectRoot } from "./runtimePaths";
import {
  DomainModel,
  TotalsData,
  VisibilityEntry,
  WorkbookProfile
} from "./domainTypes";

function readJson<T>(fileName: string): T {
  const filePath = path.join(getProjectRoot(), "data", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function getDomainModel(): DomainModel {
  return readJson<DomainModel>("domain_model.json");
}

export function getTotalsData(): TotalsData {
  return readJson<TotalsData>("totals.json");
}

export function getVisibilityData(): VisibilityEntry[] {
  return readJson<VisibilityEntry[]>("visibility.json");
}

export function getWorkbookProfile(): WorkbookProfile | null {
  const filePath = path.join(getProjectRoot(), "data", "workbook_profile.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as WorkbookProfile;
}
