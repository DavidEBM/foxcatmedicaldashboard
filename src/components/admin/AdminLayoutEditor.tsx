"use client";

import { useMemo, useState } from "react";

export interface AdminLayoutItem {
  id: string;
  label: string;
  description?: string;
  visible: boolean;
  order: number;
}

interface AdminLayoutEditorProps {
  items: AdminLayoutItem[];
  onChange?: (items: AdminLayoutItem[]) => void;
  onSave?: (items: AdminLayoutItem[]) => void | Promise<void>;
  saving?: boolean;
}

export default function AdminLayoutEditor({
  items,
  onChange,
  onSave,
  saving = false,
}: AdminLayoutEditorProps) {
  const [localItems, setLocalItems] =
    useState<AdminLayoutItem[]>(() =>
      [...items].sort((a, b) => a.order - b.order)
    );

  const hasChanges = useMemo(() => {
    return JSON.stringify(localItems) !==
      JSON.stringify(
        [...items].sort((a, b) => a.order - b.order)
      );
  }, [items, localItems]);

  function updateItems(
    nextItems: AdminLayoutItem[]
  ) {
    const normalizedItems = nextItems.map(
      (item, index) => ({
        ...item,
        order: index,
      })
    );

    setLocalItems(normalizedItems);
    onChange?.(normalizedItems);
  }

  function moveItem(
    itemId: string,
    direction: "up" | "down"
  ) {
    const currentIndex = localItems.findIndex(
      (item) => item.id === itemId
    );

    if (currentIndex === -1) {
      return;
    }

    const targetIndex =
      direction === "up"
        ? currentIndex - 1
        : currentIndex + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= localItems.length
    ) {
      return;
    }

    const nextItems = [...localItems];

    const currentItem =
      nextItems[currentIndex];

    nextItems[currentIndex] =
      nextItems[targetIndex];

    nextItems[targetIndex] = currentItem;

    updateItems(nextItems);
  }

  function toggleVisibility(itemId: string) {
    const nextItems = localItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            visible: !item.visible,
          }
        : item
    );

    updateItems(nextItems);
  }

  function handleReset() {
    const resetItems = [...items].sort(
      (a, b) => a.order - b.order
    );

    setLocalItems(resetItems);
    onChange?.(resetItems);
  }

  async function handleSave() {
    if (!onSave || saving) {
      return;
    }

    await onSave(localItems);
  }

  return (
    <section className="admin-module">
      <div className="admin-module-header">
        <div>
          <span className="admin-eyebrow">
            CONFIGURACIÓN
          </span>

          <h2>
            Editor de distribución
          </h2>

          <p>
            Organiza los módulos del panel y
            controla cuáles estarán visibles.
          </p>
        </div>

        <div className="admin-layout-editor-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            Restablecer
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving
              ? "Guardando..."
              : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="admin-layout-editor">
        {localItems.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              ◇
            </div>

            <h3>
              No hay módulos configurados
            </h3>

            <p>
              No existen elementos disponibles
              para configurar.
            </p>
          </div>
        ) : (
          <div className="admin-layout-list">
            {localItems.map((item, index) => {
              const isFirst = index === 0;
              const isLast =
                index === localItems.length - 1;

              return (
                <article
                  key={item.id}
                  className={
                    item.visible
                      ? "admin-layout-item"
                      : "admin-layout-item is-hidden"
                  }
                >
                  <div className="admin-layout-item-main">
                    <div className="admin-layout-item-handle">
                      <span />
                      <span />
                      <span />
                    </div>

                    <div className="admin-layout-item-info">
                      <div className="admin-layout-item-title">
                        <strong>
                          {item.label}
                        </strong>

                        {!item.visible && (
                          <span className="soft-badge">
                            Oculto
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p>
                          {item.description}
                        </p>
                      )}

                      <small>
                        Posición {index + 1}
                      </small>
                    </div>
                  </div>

                  <div className="admin-layout-item-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        moveItem(
                          item.id,
                          "up"
                        )
                      }
                      disabled={
                        isFirst || saving
                      }
                      aria-label={`Mover ${item.label} hacia arriba`}
                      title="Mover arriba"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        moveItem(
                          item.id,
                          "down"
                        )
                      }
                      disabled={
                        isLast || saving
                      }
                      aria-label={`Mover ${item.label} hacia abajo`}
                      title="Mover abajo"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        toggleVisibility(
                          item.id
                        )
                      }
                      disabled={saving}
                    >
                      {item.visible
                        ? "Ocultar"
                        : "Mostrar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}