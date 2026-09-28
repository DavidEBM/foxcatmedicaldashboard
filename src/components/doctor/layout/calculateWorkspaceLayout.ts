import type {
  WorkspaceStyle,
  WorkspaceWidgetLayout,
} from "@/types/doctor-workspace";

/* =========================================================
   TYPES
========================================================= */

interface CalculateWorkspaceLayoutOptions {
  layouts: WorkspaceWidgetLayout[];
  style: WorkspaceStyle;
  containerWidth: number;
}

interface PositionedWidget {
  layout: WorkspaceWidgetLayout;
  width: number;
  height: number;
  x: number;
  y: number;
  row: number;
}

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(
  value: number | undefined,
  fallback: number
): number {
  return Number.isFinite(value)
    ? Number(value)
    : fallback;
}

function safeInteger(
  value: number | undefined,
  fallback: number
): number {
  const safe = safeNumber(value, fallback);

  return Math.floor(safe);
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  if (max < min) {
    return min;
  }

  return Math.min(
    Math.max(value, min),
    max
  );
}

/* =========================================================
   STYLE VALUES
========================================================= */

function getHorizontalPadding(
  style: WorkspaceStyle
): number {
  return Math.max(
    0,
    safeNumber(
      style.horizontalPadding,
      0
    )
  );
}

function getVerticalPadding(
  style: WorkspaceStyle
): number {
  return Math.max(
    0,
    safeNumber(
      style.verticalPadding,
      0
    )
  );
}

function getColumnGap(
  style: WorkspaceStyle
): number {
  return Math.max(
    0,
    safeNumber(
      style.gap,
      0
    )
  );
}

function getRowGap(
  style: WorkspaceStyle
): number {
  return Math.max(
    0,
    safeNumber(
      style.rowGap,
      getColumnGap(style)
    )
  );
}

/* =========================================================
   AVAILABLE WIDTH
========================================================= */

function getAvailableWidth(
  style: WorkspaceStyle,
  containerWidth: number
): number {
  const safeContainerWidth =
    Math.max(
      1,
      safeNumber(
        containerWidth,
        1
      )
    );

  const padding =
    getHorizontalPadding(style);

  return Math.max(
    1,
    safeContainerWidth -
      padding * 2
  );
}

/* =========================================================
   WIDGET CONSTRAINTS
========================================================= */

function getWidgetMinWidth(
  layout: WorkspaceWidgetLayout,
  style: WorkspaceStyle
): number {
  const configured =
    layout.constraints?.minWidth ??
    style.widgetMinWidth;

  return Math.max(
    1,
    safeNumber(
      configured,
      1
    )
  );
}

function getWidgetMaxWidth(
  layout: WorkspaceWidgetLayout,
  style: WorkspaceStyle,
  availableWidth: number
): number {
  const minWidth =
    getWidgetMinWidth(
      layout,
      style
    );

  const configuredMax =
    layout.constraints?.maxWidth;

  const requestedMax =
    configuredMax !== undefined &&
    Number.isFinite(configuredMax)
      ? Math.max(
          minWidth,
          configuredMax
        )
      : Number.POSITIVE_INFINITY;

  /*
   * El widget nunca puede ser más ancho
   * que el canvas disponible.
   */
  return Math.max(
    1,
    Math.min(
      requestedMax,
      availableWidth
    )
  );
}

function getWidgetMinHeight(
  layout: WorkspaceWidgetLayout,
  style: WorkspaceStyle
): number {
  const configured =
    layout.constraints?.minHeight ??
    style.widgetMinHeight;

  return Math.max(
    1,
    safeNumber(
      configured,
      1
    )
  );
}

function getWidgetMaxHeight(
  layout: WorkspaceWidgetLayout,
  style: WorkspaceStyle
): number {
  const minHeight =
    getWidgetMinHeight(
      layout,
      style
    );

  const configuredMax =
    layout.constraints?.maxHeight;

  if (
    configuredMax === undefined ||
    !Number.isFinite(configuredMax)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    minHeight,
    configuredMax
  );
}

/* =========================================================
   INITIAL WIDGET SIZE
========================================================= */

function resolveWidgetWidth(
  layout: WorkspaceWidgetLayout,
  style: WorkspaceStyle,
  availableWidth: number
): number {
  const minWidth =
    getWidgetMinWidth(
      layout,
      style
    );

  const maxWidth =
    getWidgetMaxWidth(
      layout,
      style,
      availableWidth
    );

  const requestedWidth =
    safeNumber(
      layout.width,
      minWidth
    );

  /*
   * Si el canvas es físicamente menor
   * que el mínimo del widget, utilizamos
   * el espacio disponible.
   */
  if (
    availableWidth <
    minWidth
  ) {
    return Math.max(
      1,
      availableWidth
    );
  }

  return clamp(
    requestedWidth,
    minWidth,
    maxWidth
  );
}

function resolveWidgetHeight(
  layout: WorkspaceWidgetLayout,
  style: WorkspaceStyle
): number {
  const minHeight =
    getWidgetMinHeight(
      layout,
      style
    );

  const maxHeight =
    getWidgetMaxHeight(
      layout,
      style
    );

  const requestedHeight =
    safeNumber(
      layout.height,
      minHeight
    );

  return clamp(
    requestedHeight,
    minHeight,
    maxHeight
  );
}

/* =========================================================
   ORDER
========================================================= */

function normalizeVisibleOrder(
  layouts: WorkspaceWidgetLayout[]
): WorkspaceWidgetLayout[] {
  return [...layouts]
    .sort(
      (a, b) =>
        safeNumber(a.order, 0) -
        safeNumber(b.order, 0)
    )
    .map(
      (
        layout,
        index
      ) => ({
        ...layout,
        order: index,
      })
    );
}

/* =========================================================
   PACKING
========================================================= */

/*
 * Determina si un widget puede entrar
 * en la fila actual.
 *
 * No modifica el tamaño del widget.
 */
function canFitInCurrentRow(
  currentX: number,
  width: number,
  canvasRight: number,
  widgetsInCurrentRow: number,
  maximumColumns: number
): boolean {
  if (
    widgetsInCurrentRow >=
    maximumColumns
  ) {
    return false;
  }

  return (
    currentX +
      width <=
    canvasRight
  );
}

/*
 * Número máximo de columnas.
 *
 * IMPORTANTE:
 * Esto se utiliza únicamente como
 * límite de packing. No modifica
 * el tamaño individual del widget.
 */
function getMaximumColumns(
  style: WorkspaceStyle,
  availableWidth: number
): number {
  const requestedColumns =
    Math.max(
      1,
      safeInteger(
        style.columns,
        1
      )
    );

  const gap =
    getColumnGap(style);

  /*
   * Utilizamos el mínimo global
   * solamente para determinar una
   * capacidad aproximada de columnas.
   *
   * El tamaño real de cada widget
   * continúa dependiendo de sus propias
   * constraints.
   */
  const minimumWidth =
    Math.max(
      1,
      safeNumber(
        style.widgetMinWidth,
        1
      )
    );

  const possibleColumns =
    Math.max(
      1,
      Math.floor(
        (
          availableWidth +
          gap
        ) /
        (
          minimumWidth +
          gap
        )
      )
    );

  return Math.max(
    1,
    Math.min(
      requestedColumns,
      possibleColumns
    )
  );
}

/* =========================================================
   PACK WIDGETS
========================================================= */

function packWidgets(
  layouts: WorkspaceWidgetLayout[],
  style: WorkspaceStyle,
  containerWidth: number
): PositionedWidget[] {
  const availableWidth =
    getAvailableWidth(
      style,
      containerWidth
    );

  const horizontalPadding =
    getHorizontalPadding(
      style
    );

  const verticalPadding =
    getVerticalPadding(
      style
    );

  const columnGap =
    getColumnGap(style);

  const rowGap =
    getRowGap(style);

  const canvasRight =
    horizontalPadding +
    availableWidth;

  const maximumColumns =
    getMaximumColumns(
      style,
      availableWidth
    );

  const positioned:
    PositionedWidget[] = [];

  let currentX =
    horizontalPadding;

  let currentY =
    verticalPadding;

  let currentRow =
    0;

  let currentRowHeight =
    0;

  let widgetsInCurrentRow =
    0;

  for (
    const layout of layouts
  ) {
    const requestedWidth =
      resolveWidgetWidth(
        layout,
        style,
        availableWidth
      );

    const height =
      resolveWidgetHeight(
        layout,
        style
      );

    /*
     * Si el widget no cabe en la fila,
     * comenzamos una nueva.
     */
    const fitsCurrentRow =
      canFitInCurrentRow(
        currentX,
        requestedWidth,
        canvasRight,
        widgetsInCurrentRow,
        maximumColumns
      );

    if (
      positioned.length > 0 &&
      !fitsCurrentRow
    ) {
      currentY +=
        currentRowHeight +
        rowGap;

      currentRow += 1;

      currentX =
        horizontalPadding;

      currentRowHeight =
        0;

      widgetsInCurrentRow =
        0;
    }

    /*
     * El ancho disponible desde la posición
     * actual hasta el borde del canvas.
     */
    const remainingWidth =
      Math.max(
        1,
        canvasRight -
          currentX
      );

    /*
     * No hacemos un shrink arbitrario salvo
     * que sea físicamente necesario porque
     * el canvas es más pequeño que el widget.
     */
    const width =
      Math.min(
        requestedWidth,
        remainingWidth
      );

    positioned.push({
      layout,

      width,

      height,

      x:
        currentX,

      y:
        currentY,

      row:
        currentRow,
    });

    currentRowHeight =
      Math.max(
        currentRowHeight,
        height
      );

    widgetsInCurrentRow += 1;

    currentX +=
      width +
      columnGap;
  }

  return positioned;
}

void packWidgets;

/*
 * Packing compacto para el workspace absoluto. Cada widget conserva su
 * columna/posición X, pero su Y se calcula contra los widgets que realmente
 * se cruzan horizontalmente; no hereda la altura máxima de una fila completa.
 */
function packWidgetsCompact(
  layouts: WorkspaceWidgetLayout[],
  style: WorkspaceStyle,
  containerWidth: number
): PositionedWidget[] {
  const paddingX = getHorizontalPadding(style);
  const paddingY = getVerticalPadding(style);
  const columnGap = getColumnGap(style);
  const rowGap = getRowGap(style);
  const availableWidth = getAvailableWidth(style, containerWidth);
  const right = paddingX + availableWidth;
  const positioned: PositionedWidget[] = [];

  let currentX = paddingX;
  let currentY = paddingY;
  let currentRowHeight = 0;
  let hasWidgetsInRow = false;

  for (const layout of layouts) {
    const requestedWidth = resolveWidgetWidth(layout, style, availableWidth);
    const width = Math.min(requestedWidth, Math.max(1, availableWidth));
    const height = resolveWidgetHeight(layout, style);

    /*
     * El orden es la única fuente de verdad del packing. No reutilizamos
     * layout.x/layout.y porque pueden pertenecer a una distribución anterior.
     */
    if (hasWidgetsInRow && currentX + width > right) {
      currentY += currentRowHeight + rowGap;
      currentX = paddingX;
      currentRowHeight = 0;
      hasWidgetsInRow = false;
    }

    const x = currentX;
    const y = currentY;

    positioned.push({
      layout,
      width,
      height,
      x,
      y,
      row: positioned.length,
    });

    currentX += width + columnGap;
    currentRowHeight = Math.max(currentRowHeight, height);
    hasWidgetsInRow = true;
  }

  return positioned;
}

/* =========================================================
   MAIN
========================================================= */

export function calculateWorkspaceLayout({
  layouts,
  style,
  containerWidth,
}: CalculateWorkspaceLayoutOptions):
  WorkspaceWidgetLayout[] {
  if (
    layouts.length === 0
  ) {
    return [];
  }

  const safeContainerWidth =
    Math.max(
      1,
      safeNumber(
        containerWidth,
        1
      )
    );

  /*
   * Únicamente los widgets visibles
   * participan en el packing.
   */
  const visibleLayouts =
    normalizeVisibleOrder(
      layouts.filter(
        (layout) =>
          layout.visible
      )
    );

  /*
   * Si no hay widgets visibles,
   * no modificamos nada.
   */
  if (
    visibleLayouts.length === 0
  ) {
    return layouts.map(
      (layout) => ({
        ...layout,
      })
    );
  }

  /*
   * Calculamos las posiciones.
   */
  const positioned =
    packWidgetsCompact(
      visibleLayouts,
      style,
      safeContainerWidth
    );

  /*
   * Copia independiente.
   */
  const result =
    layouts.map(
      (layout) => ({
        ...layout,
      })
    );

  /*
   * Aplicar posiciones y dimensiones
   * solamente a widgets visibles.
   */
  positioned.forEach(
    (
      positionedWidget,
      index
    ) => {
      const {
        layout,
        width,
        height,
        x,
        y,
      } = positionedWidget;

      const resultIndex =
        result.findIndex(
          (item) =>
            item.id ===
            layout.id
        );

      if (
        resultIndex === -1
      ) {
        return;
      }

      result[
        resultIndex
      ] = {
        ...result[
          resultIndex
        ],

        x,

        y,

        width,

        height,

        order: index,

        visible: true,
      };
    }
  );

  /*
   * Los widgets ocultos quedan después
   * de los visibles, conservando entre ellos
   * su orden relativo.
   */
  let hiddenOrder =
    positioned.length;

  const visibleIds =
    new Set(
      positioned.map(
        ({
          layout,
        }) =>
          layout.id
      )
    );

  const visibleResult =
    result
      .filter(
        (layout) =>
          visibleIds.has(
            layout.id
          )
      )
      .sort(
        (a, b) =>
          safeNumber(a.order, 0) -
          safeNumber(b.order, 0)
      );

  const hiddenResult =
    result
      .filter(
        (layout) =>
          !visibleIds.has(
            layout.id
          )
      )
      .sort(
        (a, b) =>
          safeNumber(a.order, 0) -
          safeNumber(b.order, 0)
      )
      .map(
        (layout) => {
          const normalized =
            {
              ...layout,

              order:
                hiddenOrder,
            };

          hiddenOrder += 1;

          return normalized;
        }
      );

  return [
    ...visibleResult,
    ...hiddenResult,
  ];
}
