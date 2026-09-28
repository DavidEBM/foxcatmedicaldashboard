"use client";

import type { WorkspaceStyle } from "@/types/doctor-workspace";

interface WorkspaceStyleEditorProps {
  isOpen: boolean;
  draft: WorkspaceStyle;
  onChange: (changes: Partial<WorkspaceStyle>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onReset?: () => void;
}

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

const MIN_GAP = 4;
const MAX_GAP = 48;

const MIN_ROW_GAP = 4;
const MAX_ROW_GAP = 48;

const MIN_HORIZONTAL_PADDING = 0;
const MAX_HORIZONTAL_PADDING = 64;

const MIN_VERTICAL_PADDING = 0;
const MAX_VERTICAL_PADDING = 64;

const MIN_WIDGET_WIDTH = 180;
const MAX_WIDGET_WIDTH = 600;

const MIN_WIDGET_HEIGHT = 120;
const MAX_WIDGET_HEIGHT = 500;

const MIN_WIDGET_RADIUS = 0;
const MAX_WIDGET_RADIUS = 32;

export default function WorkspaceStyleEditor({
  isOpen,
  draft,
  onChange,
  onConfirm,
  onCancel,
  onReset,
}: WorkspaceStyleEditorProps) {
  if (!isOpen) {
    return null;
  }

  const handleNumberChange = (
    key: keyof WorkspaceStyle,
    value: string
  ) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    onChange({
      [key]: parsed,
    });
  };

  return (
    <div
      className="workspace-style-editor-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        className="workspace-style-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-style-editor-title"
      >
        <header className="workspace-style-editor-header">
          <div>
            <span className="workspace-style-editor-eyebrow">
              Espacio de trabajo
            </span>

            <h2 id="workspace-style-editor-title">
              Cambiar estilos
            </h2>

            <p>
              Ajusta la distribución visual de los widgets.
            </p>
          </div>

          <button
            type="button"
            className="workspace-style-editor-close"
            onClick={onCancel}
            aria-label="Cerrar editor de estilos"
            title="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="workspace-style-editor-body">
          <section className="workspace-style-editor-section">
            <div className="workspace-style-editor-section-heading">
              <strong>Distribución</strong>
              <span>Organización general</span>
            </div>

            <div className="workspace-style-editor-grid">
              <label className="workspace-style-editor-field">
                <span>Columnas</span>

                <input
                  type="number"
                  min={MIN_COLUMNS}
                  max={MAX_COLUMNS}
                  step={1}
                  value={draft.columns}
                  onChange={(event) =>
                    handleNumberChange(
                      "columns",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="workspace-style-editor-field">
                <span>Separación horizontal</span>

                <input
                  type="number"
                  min={MIN_GAP}
                  max={MAX_GAP}
                  step={1}
                  value={draft.gap}
                  onChange={(event) =>
                    handleNumberChange(
                      "gap",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>

              <label className="workspace-style-editor-field">
                <span>Separación vertical</span>

                <input
                  type="number"
                  min={MIN_ROW_GAP}
                  max={MAX_ROW_GAP}
                  step={1}
                  value={draft.rowGap}
                  onChange={(event) =>
                    handleNumberChange(
                      "rowGap",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>
            </div>
          </section>

          <section className="workspace-style-editor-section">
            <div className="workspace-style-editor-section-heading">
              <strong>Espaciado</strong>
              <span>Margen interno del workspace</span>
            </div>

            <div className="workspace-style-editor-grid">
              <label className="workspace-style-editor-field">
                <span>Padding horizontal</span>

                <input
                  type="number"
                  min={MIN_HORIZONTAL_PADDING}
                  max={MAX_HORIZONTAL_PADDING}
                  step={1}
                  value={draft.horizontalPadding}
                  onChange={(event) =>
                    handleNumberChange(
                      "horizontalPadding",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>

              <label className="workspace-style-editor-field">
                <span>Padding vertical</span>

                <input
                  type="number"
                  min={MIN_VERTICAL_PADDING}
                  max={MAX_VERTICAL_PADDING}
                  step={1}
                  value={draft.verticalPadding}
                  onChange={(event) =>
                    handleNumberChange(
                      "verticalPadding",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>
            </div>
          </section>

          <section className="workspace-style-editor-section">
            <div className="workspace-style-editor-section-heading">
              <strong>Tamaño de widgets</strong>
              <span>Límites mínimos globales</span>
            </div>

            <div className="workspace-style-editor-grid">
              <label className="workspace-style-editor-field">
                <span>Ancho mínimo</span>

                <input
                  type="number"
                  min={MIN_WIDGET_WIDTH}
                  max={MAX_WIDGET_WIDTH}
                  step={10}
                  value={draft.widgetMinWidth}
                  onChange={(event) =>
                    handleNumberChange(
                      "widgetMinWidth",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>

              <label className="workspace-style-editor-field">
                <span>Alto mínimo</span>

                <input
                  type="number"
                  min={MIN_WIDGET_HEIGHT}
                  max={MAX_WIDGET_HEIGHT}
                  step={10}
                  value={draft.widgetMinHeight}
                  onChange={(event) =>
                    handleNumberChange(
                      "widgetMinHeight",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>
            </div>
          </section>

          <section className="workspace-style-editor-section">
            <div className="workspace-style-editor-section-heading">
              <strong>Apariencia</strong>
              <span>Forma de los widgets</span>
            </div>

            <div className="workspace-style-editor-grid">
              <label className="workspace-style-editor-field">
                <span>Radio de borde</span>

                <input
                  type="number"
                  min={MIN_WIDGET_RADIUS}
                  max={MAX_WIDGET_RADIUS}
                  step={1}
                  value={draft.widgetRadius}
                  onChange={(event) =>
                    handleNumberChange(
                      "widgetRadius",
                      event.target.value
                    )
                  }
                />

                <small>px</small>
              </label>
            </div>
          </section>
        </div>

        <footer className="workspace-style-editor-footer">
          <div className="workspace-style-editor-footer-left">
            {onReset && (
              <button
                type="button"
                className="workspace-style-editor-button workspace-style-editor-button-secondary"
                onClick={onReset}
              >
                Restablecer
              </button>
            )}
          </div>

          <div className="workspace-style-editor-footer-right">
            <button
              type="button"
              className="workspace-style-editor-button workspace-style-editor-button-secondary"
              onClick={onCancel}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="workspace-style-editor-button workspace-style-editor-button-primary"
              onClick={onConfirm}
            >
              Confirmar
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}