export function parseSqlPatients(sql: string): Record<string, unknown>[] {
	const rows: Record<string, unknown>[] = [];
	const insertPattern = /INSERT\s+INTO\s+[`"']?[^\s(`"']+[`"']?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/gi;
	let match: RegExpExecArray | null;

	while ((match = insertPattern.exec(sql)) !== null) {
		const columns = match[1]
			.split(",")
			.map((column) => column.trim().replace(/^[`"']|[`"']$/g, ""));
		const valuesBlock = match[2];
		const tuples: string[] = [];
		let tupleStart = -1;
		let depth = 0;
		let quote: string | null = null;
		let escaped = false;

		for (let index = 0; index < valuesBlock.length; index += 1) {
			const character = valuesBlock[index];
			if (quote) {
				if (escaped) escaped = false;
				else if (character === "\\") escaped = true;
				else if (character === quote) quote = null;
				continue;
			}
			if (character === "'" || character === '"') {
				quote = character;
			} else if (character === "(") {
				if (depth === 0) tupleStart = index + 1;
				depth += 1;
			} else if (character === ")") {
				depth -= 1;
				if (depth === 0 && tupleStart >= 0) {
					tuples.push(valuesBlock.slice(tupleStart, index));
					tupleStart = -1;
				}
			}
		}

		for (const tuple of tuples) {
			const values: string[] = [];
			let valueStart = 0;
			let valueQuote: string | null = null;
			let valueEscaped = false;

			for (let index = 0; index < tuple.length; index += 1) {
				const character = tuple[index];
				if (valueQuote) {
					if (valueEscaped) valueEscaped = false;
					else if (character === "\\") valueEscaped = true;
					else if (character === valueQuote) valueQuote = null;
				} else if (character === "'" || character === '"') {
					valueQuote = character;
				} else if (character === ",") {
					values.push(tuple.slice(valueStart, index).trim());
					valueStart = index + 1;
				}
			}
			values.push(tuple.slice(valueStart).trim());

			const record: Record<string, unknown> = {};
			columns.forEach((column, index) => {
				const raw = values[index] ?? "";
				if (/^NULL$/i.test(raw)) {
					record[column] = null;
					return;
				}
				const unquoted = raw.replace(/^(['"])([\s\S]*)\1$/, "$2")
					.replace(/\\([\\'"nrt])/g, (_match, escaped: string) => ({ n: "\n", r: "\r", t: "\t" }[escaped] ?? escaped));
				const numeric = Number(unquoted);
				record[column] = unquoted !== "" && Number.isFinite(numeric) ? numeric : unquoted;
			});
			rows.push(record);
		}
	}

	return rows;
}