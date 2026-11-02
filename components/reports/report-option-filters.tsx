import { DataLoadError } from "@/components/data-load-error";
import {
  ReportSelectFilters,
  type ReportFilterSelect,
} from "@/components/reports/report-filter-bar";
import {
  firstReportParam,
  type ReportParams,
  type ReportTab,
} from "@/components/reports/report-shell";
import { readOwnerId } from "@/lib/access";
import { checklistReadOwner } from "@/lib/checklist-access";
import { getChecklistReportOptions } from "@/lib/checklist-report";
import { getManualWorkReportOptions } from "@/lib/manual-work-report";
import { getReportOptions } from "@/lib/queries";
import type { SessionUser } from "@/lib/types";

export async function ReportOptionFilters({
  tab,
  user,
  params,
}: {
  tab: ReportTab;
  user: SessionUser;
  params: ReportParams;
}) {
  const ownerId =
    tab === "checklist" || tab === "tindak-lanjut"
      ? checklistReadOwner(user)
      : readOwnerId(user);
  const filters: ReportFilterSelect[] = [];
  if (tab === "lembur") {
    const options = await getReportOptions(ownerId).catch(() => null);
    if (!options)
      return <DataLoadError message="Pilihan filter laporan gagal dimuat." />;
    filters.push(
      {
        key: "employeeId",
        id: "lembur-employee",
        label: "Pekerja",
        value: firstReportParam(params.employeeId) ?? "",
        placeholder: "Semua pekerja",
        options: [
          { value: "", label: "Semua pekerja" },
          ...options.employees.map((employee) => ({
            value: employee.id,
            label: employee.name,
          })),
        ],
        className: "sm:w-44",
      },
      {
        key: "spklId",
        id: "lembur-spkl",
        label: "SPKL",
        value: firstReportParam(params.spklId) ?? "",
        placeholder: "Semua SPKL",
        options: [
          { value: "", label: "Semua SPKL" },
          ...options.spkls.map((spkl) => ({
            value: spkl.id,
            label: `${spkl.number} · ${spkl.title}`,
          })),
        ],
        className: "sm:w-56",
      },
    );
  } else if (tab === "pekerjaan") {
    const options = await getManualWorkReportOptions(ownerId).catch(() => null);
    if (!options)
      return <DataLoadError message="Pilihan filter laporan gagal dimuat." />;
    filters.push(
      {
        key: "locationId",
        id: "pekerjaan-location",
        label: "Area",
        value: firstReportParam(params.locationId) ?? "",
        placeholder: "Semua area",
        options: [
          { value: "", label: "Semua area" },
          ...options.locations.map((location) => ({
            value: location.id,
            label: location.path,
          })),
        ],
        className: "sm:w-44",
        resetKeys: ["includeSub"],
      },
      {
        key: "employeeId",
        id: "pekerjaan-employee",
        label: "Pekerja",
        value: firstReportParam(params.employeeId) ?? "",
        placeholder: "Semua pekerja",
        options: [
          { value: "", label: "Semua pekerja" },
          ...options.employees.map((employee) => ({
            value: employee.id,
            label: employee.name,
          })),
        ],
        className: "sm:w-44",
      },
    );
  } else {
    const options = await getChecklistReportOptions(ownerId).catch(() => null);
    if (!options)
      return <DataLoadError message="Pilihan filter laporan gagal dimuat." />;
    filters.push({
      key: "locationId",
      id: `${tab}-location`,
      label: "Area",
      value: firstReportParam(params.locationId) ?? "",
      placeholder: "Semua area",
      options: [
        { value: "", label: "Semua area" },
        ...options.locations.map((location) => ({
          value: location.id,
          label: location.path,
        })),
      ],
      className: "sm:w-44",
      resetKeys: ["includeSub"],
    });
    if (tab === "checklist")
      filters.push({
        key: "templateId",
        id: "checklist-template",
        label: "Template",
        value: firstReportParam(params.templateId) ?? "",
        placeholder: "Semua template",
        options: [
          { value: "", label: "Semua template" },
          ...options.templates.map((template) => ({
            value: template.id,
            label: template.name,
          })),
        ],
        className: "sm:w-48",
      });
  }
  return <ReportSelectFilters filters={filters} />;
}
