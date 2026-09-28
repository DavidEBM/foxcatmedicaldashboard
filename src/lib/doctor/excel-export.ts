import * as XLSX from "xlsx";

export function downloadExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string
): void {
  if (!rows.length) {
    throw new Error("No hay datos para exportar.");
  }

  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    sheetName
  );

  XLSX.writeFile(workbook, filename);
}