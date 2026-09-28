"use client";

import type { ReactNode } from "react";

export interface AdminTableColumn<T> {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render?: (
    item: T,
    index: number
  ) => ReactNode;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  getRowKey: (
    item: T,
    index: number
  ) => string;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  error?: string;
  className?: string;
}

export default function AdminTable<T>({
  columns,
  data,
  getRowKey,
  loading = false,
  loadingMessage = "Cargando información...",
  emptyMessage = "No hay registros para mostrar.",
  error = "",
  className = "",
}: AdminTableProps<T>) {
  const tableClassName = [
    "users-table",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (error) {
    return (
      <div
        className="alert alert-error"
        role="alert"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="users-table-container">
      <table className={tableClassName}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={
                  column.headerClassName
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="empty-users"
              >
                {loadingMessage}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="empty-users"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={getRowKey(item, index)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.cellClassName
                    }
                  >
                    {column.render
                      ? column.render(
                          item,
                          index
                        )
                      : getDefaultCellValue(
                          item,
                          column.key
                        )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function getDefaultCellValue<T>(
  item: T,
  key: string
): ReactNode {
  if (
    item === null ||
    item === undefined
  ) {
    return "—";
  }

  if (
    typeof item !== "object" ||
    !(key in item)
  ) {
    return "—";
  }

  const value = (
    item as Record<string, unknown>
  )[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  return String(value);
}