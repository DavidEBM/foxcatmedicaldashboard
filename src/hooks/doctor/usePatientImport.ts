"use client";

import { useState } from "react";
import { parseSqlPatients } from "@/lib/doctor/patients/patient-import/parse-sql";
import { parseSpreadsheetFile } from "@/lib/doctor/patients/patient-import/parse-spreadsheet";

export type ImportedPatientRow = Record<string, unknown>;

export async function importPatientsFromFile(file: File): Promise<ImportedPatientRow[]> {
	const extension = file.name.split(".").pop()?.toLowerCase();
	if (extension === "sql") {
		return parseSqlPatients(await file.text());
	}
	if (["xlsx", "xls", "csv"].includes(extension ?? "")) {
		return await parseSpreadsheetFile(file) as ImportedPatientRow[];
	}
	throw new Error("Formato no compatible. Selecciona un archivo SQL, XLSX, XLS o CSV.");
}

export function usePatientImport() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const parseFile = async (file: File) => {
		setLoading(true);
		setError(null);
		try {
			return await importPatientsFromFile(file);
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : "No se pudo leer el archivo.";
			setError(message);
			throw cause;
		} finally {
			setLoading(false);
		}
	};

	return { loading, error, parseFile };
}