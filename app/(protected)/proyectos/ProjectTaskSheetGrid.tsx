"use client";

import { RevoGrid } from "@revolist/react-datagrid";
import {
  Download,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Table2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  rowsCount: number;
  columnsCount: number;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 850;

function cloneCells(cells: ProjectTaskSheetCells) {
  return { ...cells };
}

function csvEscape(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export default function ProjectTaskSheetGrid({
  taskId,
  currentUserId,
  canEdit,
}: Props) {
  const [rowsCount, setRowsCount] = useState(DEFAULT_SHEET_ROWS);
  const [columnsCount, setColumnsCount] = useState(DEFAULT_SHEET_COLUMNS);
  const [cells, setCells] = useState<ProjectTaskSheetCells>({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

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
    ) =>
      JSON.stringify({
        cells: nextCells,
        rowsCount: nextRows,
        columnsCount: nextColumns,
      }),
    [cells, rowsCount, columnsCount],
  );

  const pushHistory = useCallback(
    (
      entry: HistoryEntry = {
        cells: cloneCells(cells),
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
    [cells, rowsCount, columnsCount, undoStack.length],
  );

  const applyHistoryEntry = useCallback((entry: HistoryEntry) => {
    setCells(cloneCells(entry.cells));
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
      { cells: cloneCells(cells), rowsCount, columnsCount },
    ]);
    applyHistoryEntry(previous);
  };

  const redo = () => {
    if (!canEdit || redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [
      ...current,
      { cells: cloneCells(cells), rowsCount, columnsCount },
    ]);
    applyHistoryEntry(next);
  };

  const loadSheet = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const sheet = await fetchProjectTaskSheet(taskId);

        const nextCells = sheet.cells ?? {};
        const nextRows = sheet.rows_count ?? DEFAULT_SHEET_ROWS;
        const nextColumns = sheet.columns_count ?? DEFAULT_SHEET_COLUMNS;

        setCells(nextCells);
        setRowsCount(nextRows);
        setColumnsCount(nextColumns);
        setUndoStack([]);
        setRedoStack([]);

        const saved = JSON.stringify({
          cells: nextCells,
          rowsCount: nextRows,
          columnsCount: nextColumns,
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
    rowsCount,
    columnsCount,
    taskId,
    currentUserId,
    canEdit,
    loading,
    snapshot,
  ]);

  const columns = useMemo(
    () =>
      Array.from({ length: columnsCount }, (_, index) => {
        const prop = columnLabel(index);

        return {
          prop,
          name: prop,
          size: 120,
          minSize: 72,
          sortable: false,
          readonly: !canEdit,
        };
      }),
    [columnsCount, canEdit],
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

    const nextValue = detail.val == null ? "" : String(detail.val);
    const columnIndex = columns.findIndex((column) => column.prop === prop);
    if (columnIndex < 0) return;

    const id = cellId(rowIndex, columnIndex);
    const previousValue = cells[id] ?? "";

    if (previousValue === nextValue) return;

    pushHistory(undefined, true);

    setCells((current) => {
      const next = { ...current };

      if (nextValue === "") delete next[id];
      else next[id] = nextValue;

      return next;
    });
  };

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
    <div className="flex h-full min-h-0 flex-col bg-[#17181b]">
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

          <ToolbarButton
            label="Deshacer"
            onClick={undo}
            disabled={!canEdit || undoStack.length === 0}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Rehacer"
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
              onClick={() => setMenuOpen((current) => !current)}
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
        Doble clic para editar · Ctrl/⌘ + C y V para copiar/pegar · Arrastrá los
        encabezados para redimensionar columnas.
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
              rowHeaders={{ size: 48 }}
              range
              useClipboard={{ rangeFill: true }}
              resize
              stretch={false}
              readonly={!canEdit}
              onBeforeedit={handleCellEdit}
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        )}
      </div>

      {clearConfirm ? (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/[0.50] p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[20px] border border-white/[0.09] bg-[#242426] p-5 shadow-[0_24px_70px_rgba(0,0,0,.45)]">
            <div className="text-sm font-medium text-white/[0.92]">
              ¿Vaciar la planilla?
            </div>
            <p className="mt-1 text-[11px] font-normal leading-5 text-white/[0.55]">
              Se borrará el contenido de todas las celdas. Podés deshacer la
              acción mientras mantengas abierto este drawer.
            </p>
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
