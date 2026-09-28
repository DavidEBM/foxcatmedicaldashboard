import * as XLSX from "xlsx";

export async function parseSpreadsheetFile(
  file: File
) {
  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(buffer, {
      type: "array",
    });

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      defval: "",
    }
  );
}