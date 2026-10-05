"use client";

import {
  Editor,
  RevoGrid,
  Template,
  type ColumnDataSchemaModel,
  type EditorType,
  type Editors,
} from "@revolist/react-datagrid";
import {
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDollarSign,
  Download,
  Hash,
  ListFilter,
  Loader2,
  Minus,
  MoreHorizontal,
  Percent,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Table2,
  TextCursorInput,
  Undo2,
  X,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { errorMessage, notify } from "@/lib/notifications";
import {
  DEFAULT_SHEET_COLUMNS,
  DEFAULT_SHEET_ROWS,
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ROWS,
  cellId,
  columnLabel,
  fetchProjectTaskSheet,
  type ProjectTaskSheetCells,
  type ProjectTaskSheetColumnMeta,
  type ProjectTaskSheetColumnMetaMap,
  type ProjectTaskSheetColumnType,
  upsertProjectTaskSheet,
} from "@/lib/projectTaskSheet";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  taskId: number;
  currentUserId: string | null;
  canEdit: boolean;
};

type HistoryEntry = {
  cells: ProjectTaskSheetCells;
  columnMeta: ProjectTaskSheetColumnMetaMap;
  rowsCount: number;
  columnsCount: number;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type TypedCellProps = ColumnDataSchemaModel & {
  sheetMeta?: ProjectTaskSheetColumnMeta;
  canEdit?: boolean;
  onToggle?: (rowIndex: number, prop: string) => void;
};

const AUTOSAVE_MS = 850;

const COLUMN_TYPE_OPTIONS: {
  value: ProjectTaskSheetColumnType;
  label: string;
  description: string;
  icon: typeof TextCursorInput;
}[] = [
  {
    value: "text",
    label: "Texto",
    description: "Texto libre y etiquetas.",
    icon: TextCursorInput,
  },
  {
    value: "number",
    label: "Número",
    description: "Valores numéricos.",
    icon: Hash,
  },
  {
    value: "currency",
    label: "Moneda",
    description: "Importes con formato monetario.",
    icon: CircleDollarSign,
  },
  {
    value: "percent",
    label: "Porcentaje",
    description: "Valores expresados de 0 a 100.",
    icon: Percent,
  },
  {
    value: "date",
    label: "Fecha",
    description: "Fecha con editor de calendario.",
    icon: CalendarDays,
  },
  {
    value: "checkbox",
    label: "Checkbox",
    description: "Valor verdadero o falso.",
    icon: CheckSquare,
  },
  {
    value: "select",
    label: "Lista",
    description: "Opciones controladas por dropdown.",
    icon: ListFilter,
  },
];

function cloneCells(cells: ProjectTaskSheetCells) {
  return { ...cells };
}

function cloneColumnMeta(meta: ProjectTaskSheetColumnMetaMap) {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [
      key,
      {
        ...value,
        options: value.options ? [...value.options] : undefined,
      },
    ]),
  ) as ProjectTaskSheetColumnMetaMap;
}

function getColumnMeta(
  meta: ProjectTaskSheetColumnMetaMap,
  prop: string,
): ProjectTaskSheetColumnMeta {
  return meta[prop] ?? { type: "text" };
}

function csvEscape(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function parseNumericInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  let normalized = raw.replace(/\s+/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;

  return String(numeric);
}

function normalizeDateInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00`);
    if (!Number.isNaN(date.getTime())) return raw;
  }

  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(raw);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function normalizeCheckboxInput(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  if (["true", "1", "si", "sí", "yes", "x"].includes(raw)) return "true";
  if (["false", "0", "no"].includes(raw)) return "false";

  return null;
}

function normalizeCellValue(
  value: unknown,
  meta: ProjectTaskSheetColumnMeta,
): string | null {
  const raw = value == null ? "" : String(value);

  switch (meta.type) {
    case "number":
    case "currency":
    case "percent":
      return parseNumericInput(raw);

    case "date":
      return normalizeDateInput(raw);

    case "checkbox":
      return normalizeCheckboxInput(raw);

    case "select": {
      const clean = raw.trim();
      if (!clean) return "";
      const options = meta.options ?? [];
      return options.includes(clean) ? clean : null;
    }

    case "text":
    default:
      return raw;
  }
}

function formatCellValue(
  value: unknown,
  meta: ProjectTaskSheetColumnMeta,
) {
  const raw = value == null ? "" : String(value);
  if (!raw) return "";

  switch (meta.type) {
    case "number": {
      const numeric = Number(raw);
      return Number.isFinite(numeric)
        ? new Intl.NumberFormat("es-AR", {
            maximumFractionDigits: 6,
          }).format(numeric)
        : raw;
    }

    case "currency": {
      const numeric = Number(raw);
      return Number.isFinite(numeric)
        ? new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: meta.currency ?? "ARS",
            maximumFractionDigits: 2,
          }).format(numeric)
        : raw;
    }

    case "percent": {
      const numeric = Number(raw);
      return Number.isFinite(numeric)
        ? `${new Intl.NumberFormat("es-AR", {
            maximumFractionDigits: 2,
          }).format(numeric)}%`
        : raw;
    }

    case "date": {
      const normalized = normalizeDateInput(raw);
      if (!normalized) return raw;
      const date = new Date(`${normalized}T12:00:00`);
      return new Intl.DateTimeFormat("es-AR").format(date);
    }

    case "checkbox":
      return raw === "true" ? "Sí" : "No";

    default:
      return raw;
  }
}

function TypedCell({
  value,
  rowIndex,
  prop,
  sheetMeta,
  canEdit,
  onToggle,
}: TypedCellProps) {
  const meta = sheetMeta ?? { type: "text" as const };

  if (meta.type === "checkbox") {
    const checked = String(value ?? "") === "true";

    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (canEdit) onToggle?.(rowIndex, String(prop));
        }}
        className="flex h-full w-full items-center justify-center"
        aria-label={checked ? "Desmarcar" : "Marcar"}
        disabled={!canEdit}
      >
        <span
          className={`grid h-4 w-4 place-items-center rounded border transition ${
            checked
              ? "border-[#0a84ff] bg-[#0a84ff] text-white"
              : "border-white/[0.22] bg-white/[0.035] text-transparent"
          }`}
        >
          <Check className="h-3 w-3" />
        </span>
      </button>
    );
  }

  if (meta.type === "select") {
    const label = String(value ?? "");

    return (
      <div className="flex h-full min-w-0 items-center px-1">
        {label ? (
          <span className="max-w-full truncate rounded-md border border-[#0a84ff]/15 bg-[#0a84ff]/10 px-1.5 py-0.5 text-[10px] text-[#8bc7ff]">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  const formatted = formatCellValue(value, meta);

  return (
    <div
      className={`flex h-full min-w-0 items-center truncate px-1 ${
        ["number", "currency", "percent"].includes(meta.type)
          ? "justify-end tabular-nums"
          : ""
      }`}
      title={formatted}
    >
      {formatted}
    </div>
  );
}

const NumberEditor = forwardRef(function NumberEditor(
  { column, save, close, val }: EditorType,
  _ref,
) {
  const type = ((column.column as any)?.sheetType ??
    "number") as ProjectTaskSheetColumnType;
  const initial = String(val ?? column.value ?? "");
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const normalized = parseNumericInput(value);
    if (normalized === null) return;
    save(normalized);
    close(true);
  };

  return (
    <div className="flex h-full w-full items-center bg-[#242426]">
      {type === "currency" ? (
        <span className="pl-2 text-[10px] text-white/[0.42]">
          {(column.column as any)?.sheetCurrency ?? "ARS"}
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-xs text-white outline-none"
      />
      {type === "percent" ? (
        <span className="pr-2 text-[10px] text-white/[0.42]">%</span>
      ) : null}
    </div>
  );
});

const DateEditor = forwardRef(function DateEditor(
  { column, save, close, val }: EditorType,
  _ref,
) {
  const initial = String(val ?? column.value ?? "");
  const [value, setValue] = useState(normalizeDateInput(initial) ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = () => {
    const normalized = normalizeDateInput(value);
    if (normalized === null) return;
    save(normalized);
    close(true);
  };

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      className="h-full w-full bg-[#242426] px-2 text-xs text-white outline-none"
    />
  );
});

const SelectEditor = forwardRef(function SelectEditor(
  { column, save, close, val }: EditorType,
  _ref,
) {
  const options = (((column.column as any)?.sheetOptions ?? []) as string[]);
  const initial = String(val ?? column.value ?? "");
  const selectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      ref={selectRef}
      defaultValue={initial}
      onChange={(event) => {
        save(event.target.value);
        close(true);
      }}
      onBlur={() => close()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      className="h-full w-full bg-[#242426] px-2 text-xs text-white outline-none"
    >
      <option value="">Sin valor</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
});

const CheckboxEditor = forwardRef(function CheckboxEditor(
  { column, save, close, val }: EditorType,
  _ref,
) {
  const checked = String(val ?? column.value ?? "") === "true";

  useEffect(() => {
    save(checked ? "false" : "true");
    close(true);
  }, [checked, close, save]);

  return null;
});

const GRID_EDITORS: Editors = {
  "sheet-number": Editor(NumberEditor),
  "sheet-date": Editor(DateEditor),
  "sheet-select": Editor(SelectEditor),
  "sheet-checkbox": Editor(CheckboxEditor),
};

export default function ProjectTaskSheetGrid({
  taskId,
  currentUserId,
  canEdit,
}: Props) {
  const [rowsCount, setRowsCount] = useState(DEFAULT_SHEET_ROWS);
  const [columnsCount, setColumnsCount] = useState(DEFAULT_SHEET_COLUMNS);
  const [cells, setCells] = useState<ProjectTaskSheetCells>({});
  const [columnMeta, setColumnMeta] =
    useState<ProjectTaskSheetColumnMetaMap>({});
  const [activeColumnProp, setActiveColumnProp] = useState("A");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [selectOptionsDraft, setSelectOptionsDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState<"ARS" | "USD">("ARS");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastSavedRef = useRef("");
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const ignoreRealtimeUntilRef = useRef(0);
  const lastHistoryAtRef = useRef(0);

  const snapshot = useCallback(
    (
      nextCells = cells,
      nextRows = rowsCount,
      nextColumns = columnsCount,
      nextColumnMeta = columnMeta,
    ) =>
      JSON.stringify({
        cells: nextCells,
        rowsCount: nextRows,
        columnsCount: nextColumns,
        columnMeta: nextColumnMeta,
      }),
    [cells, rowsCount, columnsCount, columnMeta],
  );

  const pushHistory = useCallback(
    (
      entry: HistoryEntry = {
        cells: cloneCells(cells),
        columnMeta: cloneColumnMeta(columnMeta),
        rowsCount,
        columnsCount,
      },
      groupRapidEdits = false,
    ) => {
      const now = Date.now();

      if (
        groupRapidEdits &&
        now - lastHistoryAtRef.current < 120 &&
        undoStack.length > 0
      ) {
        return;
      }

      lastHistoryAtRef.current = now;
      setUndoStack((current) => [...current.slice(-39), entry]);
      setRedoStack([]);
    },
    [cells, columnMeta, rowsCount, columnsCount, undoStack.length],
  );

  const applyHistoryEntry = useCallback((entry: HistoryEntry) => {
    setCells(cloneCells(entry.cells));
    setColumnMeta(cloneColumnMeta(entry.columnMeta));
    setRowsCount(entry.rowsCount);
    setColumnsCount(entry.columnsCount);
    dirtyRef.current = true;
    setSaveState("dirty");
  }, []);

  const undo = () => {
    if (!canEdit || undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [
      ...current,
      {
        cells: cloneCells(cells),
        columnMeta: cloneColumnMeta(columnMeta),
        rowsCount,
        columnsCount,
      },
    ]);
    applyHistoryEntry(previous);
  };

  const redo = () => {
    if (!canEdit || redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [
      ...current,
      {
        cells: cloneCells(cells),
        columnMeta: cloneColumnMeta(columnMeta),
        rowsCount,
        columnsCount,
      },
    ]);
    applyHistoryEntry(next);
  };

  useEffect(() => {
    const handleKeyboardUndoRedo = (event: KeyboardEvent) => {
      if (!canEdit || event.altKey) return;

      const modifierPressed = event.ctrlKey || event.metaKey;
      if (!modifierPressed) return;

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);

      if (!wantsUndo && !wantsRedo) return;

      const root = rootRef.current;
      if (!root) return;

      const path = event.composedPath?.() ?? [];
      const target = event.target;
      const eventInsideSheet =
        path.includes(root) ||
        (target instanceof Node && root.contains(target));

      const activeElement = document.activeElement;
      const focusInsideSheet =
        activeElement instanceof Node && root.contains(activeElement);

      if (!eventInsideSheet && !focusInsideSheet) return;

      const editingText = path.some((node) => {
        if (node instanceof HTMLInputElement) return true;
        if (node instanceof HTMLTextAreaElement) return true;
        if (node instanceof HTMLSelectElement) return true;
        return node instanceof HTMLElement && node.isContentEditable;
      });

      if (editingText) return;

      if (wantsUndo) {
        if (undoStack.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        undo();
        return;
      }

      if (wantsRedo) {
        if (redoStack.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        redo();
      }
    };

    document.addEventListener("keydown", handleKeyboardUndoRedo, true);

    return () => {
      document.removeEventListener("keydown", handleKeyboardUndoRedo, true);
    };
  }, [
    canEdit,
    undoStack,
    redoStack,
    cells,
    columnMeta,
    rowsCount,
    columnsCount,
  ]);

  const loadSheet = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const sheet = await fetchProjectTaskSheet(taskId);

        const nextCells = sheet.cells ?? {};
        const nextMeta = sheet.column_meta ?? {};
        const nextRows = sheet.rows_count ?? DEFAULT_SHEET_ROWS;
        const nextColumns = sheet.columns_count ?? DEFAULT_SHEET_COLUMNS;

        setCells(nextCells);
        setColumnMeta(nextMeta);
        setRowsCount(nextRows);
        setColumnsCount(nextColumns);
        setUndoStack([]);
        setRedoStack([]);

        const saved = JSON.stringify({
          cells: nextCells,
          rowsCount: nextRows,
          columnsCount: nextColumns,
          columnMeta: nextMeta,
        });

        lastSavedRef.current = saved;
        dirtyRef.current = false;
        setSaveState("saved");
      } catch (error) {
        console.error("Error loading task sheet", error);
        if (!quiet) {
          notify.error(
            errorMessage(error, "No se pudo cargar la planilla de la tarea."),
          );
        }
        setSaveState("error");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    void loadSheet();

    const channel = supabase
      .channel(`project_task_sheet_${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_task_sheets",
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          if (
            !dirtyRef.current &&
            !savingRef.current &&
            Date.now() > ignoreRealtimeUntilRef.current
          ) {
            void loadSheet(true);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSheet, taskId]);

  useEffect(() => {
    if (loading || !canEdit) return;

    const current = snapshot();
    if (current === lastSavedRef.current) {
      dirtyRef.current = false;
      if (saveState !== "saving") setSaveState("saved");
      return;
    }

    dirtyRef.current = true;
    setSaveState("dirty");

    const handle = window.setTimeout(async () => {
      try {
        savingRef.current = true;
        setSaveState("saving");

        await upsertProjectTaskSheet({
          taskId,
          rowsCount,
          columnsCount,
          cells,
          columnMeta,
          updatedBy: currentUserId,
        });

        lastSavedRef.current = current;
        dirtyRef.current = false;
        ignoreRealtimeUntilRef.current = Date.now() + 1500;
        setSaveState("saved");
      } catch (error) {
        console.error("Error autosaving task sheet", error);
        setSaveState("error");
      } finally {
        savingRef.current = false;
      }
    }, AUTOSAVE_MS);

    return () => window.clearTimeout(handle);
  }, [
    cells,
    columnMeta,
    rowsCount,
    columnsCount,
    taskId,
    currentUserId,
    canEdit,
    loading,
    snapshot,
  ]);

  const toggleCheckbox = useCallback(
    (rowIndex: number, prop: string) => {
      if (!canEdit) return;

      const columnIndex = Array.from({ length: columnsCount }, (_, index) =>
        columnLabel(index),
      ).indexOf(prop);

      if (columnIndex < 0) return;

      const id = cellId(rowIndex, columnIndex);
      pushHistory();

      setCells((current) => ({
        ...current,
        [id]: current[id] === "true" ? "false" : "true",
      }));
    },
    [canEdit, columnsCount, pushHistory],
  );

  const columns = useMemo(
    () =>
      Array.from({ length: columnsCount }, (_, index) => {
        const prop = columnLabel(index);
        const meta = getColumnMeta(columnMeta, prop);
        const cellTemplate = Template(TypedCell as any, {
          sheetMeta: meta,
          canEdit,
          onToggle: toggleCheckbox,
        });

        let editor: string | undefined;
        if (["number", "currency", "percent"].includes(meta.type)) {
          editor = "sheet-number";
        } else if (meta.type === "date") {
          editor = "sheet-date";
        } else if (meta.type === "select") {
          editor = "sheet-select";
        } else if (meta.type === "checkbox") {
          editor = "sheet-checkbox";
        }

        return {
          prop,
          name: prop,
          size: 120,
          minSize: 72,
          sortable: false,
          readonly: !canEdit,
          cellTemplate,
          editor,
          sheetType: meta.type,
          sheetOptions: meta.options ?? [],
          sheetCurrency: meta.currency ?? "ARS",
        };
      }),
    [columnsCount, columnMeta, canEdit, toggleCheckbox],
  );

  const source = useMemo(
    () =>
      Array.from({ length: rowsCount }, (_, rowIndex) => {
        const row: Record<string, string | number> = {
          __rowIndex: rowIndex,
        };

        for (let columnIndex = 0; columnIndex < columnsCount; columnIndex += 1) {
          const prop = columnLabel(columnIndex);
          row[prop] = cells[cellId(rowIndex, columnIndex)] ?? "";
        }

        return row;
      }),
    [cells, rowsCount, columnsCount],
  );

  const normalizeAndValidate = (
    prop: string,
    value: unknown,
    showError = true,
  ) => {
    const meta = getColumnMeta(columnMeta, prop);
    const normalized = normalizeCellValue(value, meta);

    if (normalized !== null) return normalized;

    if (showError) {
      const typeLabel =
        COLUMN_TYPE_OPTIONS.find((option) => option.value === meta.type)?.label ??
        meta.type;

      notify.error(
        meta.type === "select"
          ? `El valor no pertenece a las opciones de la columna ${prop}.`
          : `El valor no es válido para una columna de tipo ${typeLabel}.`,
      );
    }

    return null;
  };

  const handleCellEdit = (event: any) => {
    if (!canEdit) {
      event.preventDefault?.();
      return;
    }

    const detail = event.detail ?? {};
    const prop = String(detail.prop ?? "");
    const model = detail.model as Record<string, unknown> | undefined;
    const rowIndex =
      typeof model?.__rowIndex === "number"
        ? Number(model.__rowIndex)
        : Number(detail.rowIndex ?? detail.rgRow ?? -1);

    if (!prop || rowIndex < 0 || rowIndex >= rowsCount) return;

    const normalized = normalizeAndValidate(prop, detail.val);
    if (normalized === null) {
      event.preventDefault?.();
      return;
    }

    detail.val = normalized;

    const columnIndex = columns.findIndex((column) => column.prop === prop);
    if (columnIndex < 0) return;

    const id = cellId(rowIndex, columnIndex);
    const previousValue = cells[id] ?? "";

    if (previousValue === normalized) return;

    pushHistory(undefined, true);

    setCells((current) => {
      const next = { ...current };

      if (normalized === "") delete next[id];
      else next[id] = normalized;

      return next;
    });
  };

  const handleRangeEdit = (event: any) => {
    if (!canEdit) {
      event.preventDefault?.();
      return;
    }

    const changedRows = (event.detail?.data ?? {}) as Record<
      string,
      Record<string, unknown>
    >;

    const entries = Object.entries(changedRows);
    if (entries.length === 0) return;

    const normalizedRows: Record<string, Record<string, string>> = {};

    for (const [rowKey, rowChanges] of entries) {
      const rowIndex = Number(rowKey);
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rowsCount) {
        continue;
      }

      for (const [prop, value] of Object.entries(rowChanges ?? {})) {
        const columnIndex = columns.findIndex(
          (column) => String(column.prop) === prop,
        );

        if (columnIndex < 0 || columnIndex >= columnsCount) continue;

        const normalized = normalizeAndValidate(prop, value, false);
        if (normalized === null) {
          event.preventDefault?.();
          notify.error(
            `El rango contiene valores incompatibles con el tipo de la columna ${prop}.`,
          );
          return;
        }

        normalizedRows[rowKey] ??= {};
        normalizedRows[rowKey][prop] = normalized;
        rowChanges[prop] = normalized;
      }
    }

    pushHistory();

    setCells((current) => {
      const next = { ...current };

      for (const [rowKey, rowChanges] of Object.entries(normalizedRows)) {
        const rowIndex = Number(rowKey);

        for (const [prop, normalized] of Object.entries(rowChanges)) {
          const columnIndex = columns.findIndex(
            (column) => String(column.prop) === prop,
          );

          if (columnIndex < 0) continue;

          const id = cellId(rowIndex, columnIndex);

          if (normalized === "") delete next[id];
          else next[id] = normalized;
        }
      }

      return next;
    });
  };

  const handleAutofill = (event: any) => {
    if (!canEdit) {
      event.preventDefault?.();
      return;
    }

    const detail = event.detail ?? {};
    const oldRange = detail.oldRange;
    const newRange = detail.newRange;
    const newData = detail.newData as
      | Record<number, Record<string, unknown>>
      | undefined;

    if (!oldRange || !newRange || !newData) return;

    const verticalSeries =
      oldRange.x === oldRange.x1 &&
      newRange.x === oldRange.x &&
      newRange.x1 === oldRange.x1 &&
      oldRange.y1 > oldRange.y &&
      newRange.y1 > oldRange.y1;

    if (!verticalSeries) return;

    const columnIndex = oldRange.x;
    const prop = columnLabel(columnIndex);
    const meta = getColumnMeta(columnMeta, prop);

    if (!["number", "currency", "percent", "date"].includes(meta.type)) {
      return;
    }

    const previousRaw = cells[cellId(oldRange.y1 - 1, columnIndex)] ?? "";
    const lastRaw = cells[cellId(oldRange.y1, columnIndex)] ?? "";

    if (meta.type === "date") {
      const previousDate = normalizeDateInput(previousRaw);
      const lastDate = normalizeDateInput(lastRaw);
      if (!previousDate || !lastDate) return;

      const previousTime = new Date(`${previousDate}T12:00:00`).getTime();
      const lastTime = new Date(`${lastDate}T12:00:00`).getTime();
      const stepDays = Math.round((lastTime - previousTime) / 86400000);
      if (!Number.isFinite(stepDays)) return;

      for (let row = oldRange.y1 + 1; row <= newRange.y1; row += 1) {
        const offset = row - oldRange.y1;
        const date = new Date(lastTime + stepDays * offset * 86400000);
        const nextValue = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        newData[row] ??= {};
        newData[row][prop] = nextValue;
      }

      return;
    }

    const previous = Number(parseNumericInput(previousRaw));
    const last = Number(parseNumericInput(lastRaw));
    if (!Number.isFinite(previous) || !Number.isFinite(last)) return;

    const step = last - previous;

    for (let row = oldRange.y1 + 1; row <= newRange.y1; row += 1) {
      const offset = row - oldRange.y1;
      newData[row] ??= {};
      newData[row][prop] = String(last + step * offset);
    }
  };

  const parseSelectOptions = () =>
    Array.from(
      new Set(
        selectOptionsDraft
          .split(/[,\n;]/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ).slice(0, 50);

  const applyColumnType = (type: ProjectTaskSheetColumnType) => {
    if (!canEdit) return;

    const prop = activeColumnProp;
    const columnIndex = columns.findIndex(
      (column) => String(column.prop) === prop,
    );
    if (columnIndex < 0) return;

    const nextMeta: ProjectTaskSheetColumnMeta = {
      type,
      ...(type === "currency" ? { currency: currencyDraft } : {}),
      ...(type === "select" ? { options: parseSelectOptions() } : {}),
    };

    if (type === "select" && (nextMeta.options?.length ?? 0) === 0) {
      notify.error("Agregá al menos una opción para la lista.");
      return;
    }

    const converted = { ...cells };
    const invalidRows: number[] = [];

    for (let rowIndex = 0; rowIndex < rowsCount; rowIndex += 1) {
      const id = cellId(rowIndex, columnIndex);
      const current = cells[id] ?? "";
      if (!current) continue;

      const normalized = normalizeCellValue(current, nextMeta);
      if (normalized === null) {
        invalidRows.push(rowIndex + 1);
        continue;
      }

      if (normalized === "") delete converted[id];
      else converted[id] = normalized;
    }

    if (invalidRows.length > 0) {
      const sample = invalidRows.slice(0, 4).join(", ");
      notify.error(
        `No se puede cambiar ${prop} a ${COLUMN_TYPE_OPTIONS.find(
          (option) => option.value === type,
        )?.label}. Revisá las filas ${sample}${
          invalidRows.length > 4 ? "…" : ""
        }.`,
      );
      return;
    }

    pushHistory();
    setCells(converted);
    setColumnMeta((current) => ({
      ...current,
      [prop]: nextMeta,
    }));
    setTypeMenuOpen(false);
    notify.success(
      `Columna ${prop}: ${
        COLUMN_TYPE_OPTIONS.find((option) => option.value === type)?.label
      }.`,
    );
  };

  const openTypeMenu = (prop = activeColumnProp) => {
    const meta = getColumnMeta(columnMeta, prop);
    setActiveColumnProp(prop);
    setCurrencyDraft(meta.currency ?? "ARS");
    setSelectOptionsDraft((meta.options ?? []).join(", "));
    setTypeMenuOpen(true);
    setMenuOpen(false);
  };

  const activeMeta = getColumnMeta(columnMeta, activeColumnProp);
  const activeTypeLabel =
    COLUMN_TYPE_OPTIONS.find((option) => option.value === activeMeta.type)
      ?.label ?? "Texto";

  const addRow = () => {
    if (!canEdit) return;
    if (rowsCount >= MAX_SHEET_ROWS) {
      notify.error(`La planilla admite hasta ${MAX_SHEET_ROWS} filas.`);
      return;
    }

    pushHistory();
    setRowsCount((current) => current + 1);
  };

  const removeLastRow = () => {
    if (!canEdit || rowsCount <= 1) return;

    const lastRowIndex = rowsCount - 1;
    const hasContent = Array.from({ length: columnsCount }, (_, columnIndex) =>
      cells[cellId(lastRowIndex, columnIndex)],
    ).some((value) => String(value ?? "").trim() !== "");

    if (hasContent) {
      notify.error("La última fila contiene datos. Vaciala antes de eliminarla.");
      return;
    }

    pushHistory();
    setRowsCount((current) => current - 1);
  };

  const addColumn = () => {
    if (!canEdit) return;
    if (columnsCount >= MAX_SHEET_COLUMNS) {
      notify.error(`La planilla admite hasta ${MAX_SHEET_COLUMNS} columnas.`);
      return;
    }

    pushHistory();
    setColumnsCount((current) => current + 1);
  };

  const removeLastColumn = () => {
    if (!canEdit || columnsCount <= 1) return;

    const lastColumnIndex = columnsCount - 1;
    const lastProp = columnLabel(lastColumnIndex);
    const hasContent = Array.from({ length: rowsCount }, (_, rowIndex) =>
      cells[cellId(rowIndex, lastColumnIndex)],
    ).some((value) => String(value ?? "").trim() !== "");

    if (hasContent) {
      notify.error(
        "La última columna contiene datos. Vaciala antes de eliminarla.",
      );
      return;
    }

    pushHistory();
    setColumnsCount((current) => current - 1);
    setColumnMeta((current) => {
      const next = { ...current };
      delete next[lastProp];
      return next;
    });

    if (activeColumnProp === lastProp) {
      setActiveColumnProp(columnLabel(Math.max(0, lastColumnIndex - 1)));
      setTypeMenuOpen(false);
    }
  };

  const exportCsv = () => {
    const lines = Array.from({ length: rowsCount }, (_, rowIndex) =>
      Array.from({ length: columnsCount }, (_, columnIndex) =>
        csvEscape(cells[cellId(rowIndex, columnIndex)] ?? ""),
      ).join(","),
    );

    const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tarea-${taskId}-hoja-1.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const clearSheet = () => {
    if (!canEdit) return;
    pushHistory();
    setCells({});
    setClearConfirm(false);
    setMenuOpen(false);
  };

  const saveLabel =
    saveState === "saving"
      ? "Guardando..."
      : saveState === "dirty"
        ? "Cambios sin guardar"
        : saveState === "error"
          ? "Error al guardar"
          : "Guardado";

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-0 flex-col bg-[#17181b]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#0a84ff]/10 text-[#5ac8fa]">
            <Table2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-white/[0.88]">
              Hoja 1
            </div>
            <div className="text-[9px] font-normal text-white/[0.38]">
              {rowsCount} filas · {columnsCount} columnas
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="mr-1 inline-flex items-center gap-1.5 text-[9px] font-normal">
            {saveState === "saving" ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#5ac8fa]" />
            ) : (
              <Save
                className={`h-3 w-3 ${
                  saveState === "error"
                    ? "text-rose-300"
                    : saveState === "dirty"
                      ? "text-amber-300"
                      : "text-emerald-300"
                }`}
              />
            )}
            <span
              className={
                saveState === "error"
                  ? "text-rose-300"
                  : saveState === "dirty"
                    ? "text-amber-300"
                    : "text-white/[0.42]"
              }
            >
              {saveLabel}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() =>
                typeMenuOpen ? setTypeMenuOpen(false) : openTypeMenu()
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-white/[0.07] bg-white/[0.035] px-2.5 text-[9px] font-medium text-white/[0.66] transition hover:bg-white/[0.07] hover:text-white/[0.90] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ListFilter className="h-3.5 w-3.5 text-[#5ac8fa]" />
              <span>{activeColumnProp}</span>
              <span className="text-white/[0.32]">·</span>
              <span>{activeTypeLabel}</span>
              <ChevronDown className="h-3 w-3 text-white/[0.34]" />
            </button>

            {typeMenuOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-[310px] rounded-[16px] border border-white/[0.09] bg-[#242426] p-2 shadow-[0_24px_70px_rgba(0,0,0,.48)]">
                <div className="px-2 pb-2 pt-1">
                  <div className="text-[10px] font-medium text-white/[0.82]">
                    Tipo de columna {activeColumnProp}
                  </div>
                  <div className="mt-0.5 text-[9px] font-normal text-white/[0.36]">
                    El formato y la validación se aplican a toda la columna.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  {COLUMN_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = activeMeta.type === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          if (option.value === "select") {
                            const current = getColumnMeta(
                              columnMeta,
                              activeColumnProp,
                            );
                            setSelectOptionsDraft(
                              (current.options ?? []).join(", "),
                            );
                            if (
                              current.type === "select" &&
                              (current.options?.length ?? 0) > 0
                            ) {
                              applyColumnType("select");
                            }
                            return;
                          }

                          applyColumnType(option.value);
                        }}
                        className={`flex items-start gap-2 rounded-[11px] border px-2.5 py-2 text-left transition ${
                          selected
                            ? "border-[#0a84ff]/25 bg-[#0a84ff]/10"
                            : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            selected
                              ? "text-[#5ac8fa]"
                              : "text-white/[0.38]"
                          }`}
                        />
                        <span className="min-w-0">
                          <span
                            className={`block text-[10px] font-medium ${
                              selected
                                ? "text-white/[0.88]"
                                : "text-white/[0.64]"
                            }`}
                          >
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[8px] leading-3 text-white/[0.30]">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 border-t border-white/[0.07] pt-2">
                  <div className="px-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white/[0.38]">
                    Opciones de lista
                  </div>
                  <textarea
                    value={selectOptionsDraft}
                    onChange={(event) =>
                      setSelectOptionsDraft(event.target.value)
                    }
                    rows={2}
                    placeholder="Pendiente, En curso, Completado"
                    className="mt-1.5 w-full resize-none rounded-[10px] border border-white/[0.08] bg-white/[0.035] px-2.5 py-2 text-[10px] text-white/[0.78] outline-none transition placeholder:text-white/[0.25] focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10"
                  />
                  <div className="mt-1 text-[8px] text-white/[0.28]">
                    Separá las opciones con coma, punto y coma o una línea nueva.
                  </div>
                  <button
                    type="button"
                    onClick={() => applyColumnType("select")}
                    className="mt-2 h-8 w-full rounded-[9px] bg-white/[0.07] text-[9px] font-medium text-white/[0.72] transition hover:bg-white/[0.10] hover:text-white"
                  >
                    Aplicar como lista
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/[0.07] px-1 pt-2">
                  <span className="text-[9px] text-white/[0.38]">
                    Moneda predeterminada
                  </span>
                  <div className="flex rounded-[8px] bg-white/[0.04] p-0.5">
                    {(["ARS", "USD"] as const).map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        onClick={() => setCurrencyDraft(currency)}
                        className={`h-7 rounded-[6px] px-2 text-[9px] font-medium transition ${
                          currencyDraft === currency
                            ? "bg-white/[0.10] text-white/[0.86]"
                            : "text-white/[0.38] hover:text-white/[0.65]"
                        }`}
                      >
                        {currency}
                      </button>
                    ))}
                  </div>
                </div>

                {activeMeta.type === "currency" ? (
                  <button
                    type="button"
                    onClick={() => applyColumnType("currency")}
                    className="mt-2 h-8 w-full rounded-[9px] bg-white/[0.07] text-[9px] font-medium text-white/[0.72] transition hover:bg-white/[0.10] hover:text-white"
                  >
                    Guardar moneda
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <ToolbarButton
            label="Deshacer (Ctrl/⌘ + Z)"
            onClick={undo}
            disabled={!canEdit || undoStack.length === 0}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Rehacer (Ctrl+Y / Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!canEdit || redoStack.length === 0}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-0.5 h-6 w-px bg-white/[0.07]" />

          <ToolbarButton label="Agregar fila" onClick={addRow} disabled={!canEdit}>
            <Plus className="h-3.5 w-3.5" />
            <span>Fila</span>
          </ToolbarButton>
          <ToolbarButton
            label="Quitar última fila"
            onClick={removeLastRow}
            disabled={!canEdit || rowsCount <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            label="Agregar columna"
            onClick={addColumn}
            disabled={!canEdit}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Columna</span>
          </ToolbarButton>
          <ToolbarButton
            label="Quitar última columna"
            onClick={removeLastColumn}
            disabled={!canEdit || columnsCount <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>

          <div className="relative">
            <ToolbarButton
              label="Más acciones"
              onClick={() => {
                setMenuOpen((current) => !current);
                setTypeMenuOpen(false);
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </ToolbarButton>

            {menuOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-[13px] border border-white/[0.09] bg-[#242426] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,.45)]">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[10px] font-normal text-white/[0.70] transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </button>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setClearConfirm(true)}
                    className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[10px] font-normal text-rose-200/[0.78] transition hover:bg-rose-400/10 hover:text-rose-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Vaciar planilla
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-b border-white/[0.06] bg-white/[0.015] px-4 py-2 text-[9px] font-normal text-white/[0.34]">
        Doble clic para editar · Elegí una celda para configurar su columna ·
        arrastrá el punto de selección para autofill · Ctrl/⌘ + Z para deshacer.
      </div>

      <div className="min-h-0 flex-1 p-3">
        {loading ? (
          <div className="grid h-full min-h-[420px] place-items-center rounded-[16px] border border-white/[0.07] bg-[#1c1c1e]">
            <div className="text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#5ac8fa]" />
              <div className="mt-2 text-[10px] font-normal text-white/[0.42]">
                Cargando planilla...
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#1c1c1e]">
            <RevoGrid
              theme="darkCompact"
              columns={columns as any}
              source={source as any}
              editors={GRID_EDITORS}
              rowHeaders={{ size: 48 } as any}
              range
              useClipboard={{ rangeFill: true }}
              resize
              stretch={false}
              readonly={!canEdit}
              onBeforecellfocus={(event: any) => {
                const prop = String(event.detail?.prop ?? "");
                if (prop) setActiveColumnProp(prop);
              }}
              onHeaderclick={(event: any) => {
                const prop = String(event.detail?.prop ?? "");
                if (prop) openTypeMenu(prop);
              }}
              onBeforeedit={handleCellEdit}
              onBeforerange={handleAutofill}
              onBeforerangeedit={handleRangeEdit}
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        )}
      </div>

      {clearConfirm ? (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/[0.50] p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[20px] border border-white/[0.09] bg-[#242426] p-5 shadow-[0_24px_70px_rgba(0,0,0,.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-white/[0.92]">
                  ¿Vaciar la planilla?
                </div>
                <p className="mt-1 text-[11px] font-normal leading-5 text-white/[0.55]">
                  Se borrará el contenido de todas las celdas. Los tipos de
                  columna se conservarán.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClearConfirm(false)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/[0.38] transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearConfirm(false)}
                className="h-9 rounded-[11px] px-3 text-[10px] font-normal text-white/[0.68] transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearSheet}
                className="h-9 rounded-[11px] bg-rose-500 px-3 text-[10px] font-medium text-white transition hover:bg-rose-400"
              >
                Vaciar planilla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] border border-white/[0.07] bg-white/[0.035] px-2.5 text-[9px] font-medium text-white/[0.58] transition hover:bg-white/[0.07] hover:text-white/[0.86] disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
