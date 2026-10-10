"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  FileSpreadsheet,
  Layers,
  LayoutGrid,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  Receipt,
  Search,
  Settings,
  SlidersHorizontal,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import CardSucursales from "@/components/CardSucursales";
import Container from "@/components/Container";
import { useModulePermissions } from "@/components/permissions/ModulePermissionsProvider";
import { RedcomSelect } from "@/components/ui/redcom-select";
import { useMe } from "@/hooks/useMe";
import {
  createBranchResource,
  deleteBranchResource,
  fetchBranchResources,
  updateBranchResource,
  type BranchResource,
  type BranchResourceAccent,
  type BranchResourceIcon,
  type BranchResourceInput,
} from "@/lib/branchResources";
import {
  MODULE_PERMISSION_DEFINITIONS,
  type ModulePermissionKey,
} from "@/lib/module-permissions";
import { errorMessage, notify } from "@/lib/notifications";

type BranchResourcesSectionProps = {
  branchName: string;
  branchKey: string;
  sectionKey?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  searchPlaceholder?: string;
};

const filterIcons: Record<string, LucideIcon> = {
  Ventas: BarChart3,
  Reportes: PieChart,
  Administración: Briefcase,
  Operaciones: Settings,
  RRHH: Users,
};

const iconOptions: Array<{
  value: BranchResourceIcon;
  label: string;
}> = [
  { value: "spreadsheet", label: "Planilla" },
  { value: "pie-chart", label: "Gráfico circular" },
  { value: "calendar-clock", label: "Calendario / horario" },
  { value: "users", label: "Usuarios" },
  { value: "user-plus", label: "Usuario nuevo" },
  { value: "layers", label: "Capas / cobertura" },
  { value: "receipt", label: "Facturación" },
  { value: "target", label: "Objetivos" },
];

const accentOptions: Array<{
  value: BranchResourceAccent;
  label: string;
}> = [
  { value: "blue", label: "Azul" },
  { value: "cyan", label: "Cian" },
  { value: "violet", label: "Violeta" },
  { value: "amber", label: "Ámbar" },
  { value: "red", label: "Rojo" },
  { value: "green", label: "Verde" },
  { value: "slate", label: "Gris" },
];

const permissionOptions = [
  { value: "none", label: "Sin permiso específico" },
  ...MODULE_PERMISSION_DEFINITIONS.filter((definition) =>
    definition.key.startsWith("branch_"),
  ).map((definition) => ({
    value: definition.key,
    label: definition.label,
  })),
];

const emptyForm: BranchResourceInput = {
  title: "",
  description: "",
  category: "",
  group_name: "Reportes",
  link: "",
  icon: "spreadsheet",
  accent: "blue",
  action_label: "Abrir herramienta",
  permission_key: null,
};

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function BranchResourcesSection({
  branchName,
  branchKey,
  sectionKey = "main",
  eyebrow = "Panel interno",
  title = "Herramientas y recursos",
  description =
    "Accedé rápidamente a las aplicaciones y planillas utilizadas diariamente en Redcom.",
  searchPlaceholder = "Buscar una herramienta...",
}: BranchResourcesSectionProps) {
  const { me } = useMe();
  const { canAccessModule } = useModulePermissions();

  const [resources, setResources] = useState<BranchResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todas");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BranchResource | null>(null);
  const [form, setForm] = useState<BranchResourceInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isAdmin = me?.role === "admin";

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      setResources(await fetchBranchResources(branchKey, sectionKey));
    } catch (error) {
      notify.error(
        errorMessage(error, "No se pudieron cargar las herramientas de la sucursal."),
      );
    } finally {
      setLoading(false);
    }
  }, [branchKey, sectionKey]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const permittedResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          !resource.permission_key ||
          canAccessModule(resource.permission_key),
      ),
    [canAccessModule, resources],
  );

  const visibleFilters = useMemo(() => {
    const groups = Array.from(
      new Set(
        permittedResources
          .map((resource) => resource.group_name)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return ["Todas", ...groups];
  }, [permittedResources]);

  useEffect(() => {
    if (!visibleFilters.includes(activeFilter)) {
      setActiveFilter("Todas");
    }
  }, [activeFilter, visibleFilters]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return permittedResources.filter((resource) => {
      const matchesFilter =
        activeFilter === "Todas" || resource.group_name === activeFilter;

      const searchableText = normalizeText(
        [
          resource.title,
          resource.description,
          resource.category,
          resource.group_name,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return (
        matchesFilter &&
        (!normalizedQuery || searchableText.includes(normalizedQuery))
      );
    });
  }, [activeFilter, permittedResources, query]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setEditorOpen(true);
  };

  const openEdit = (resource: BranchResource) => {
    setEditing(resource);
    setForm({
      title: resource.title,
      description: resource.description ?? "",
      category: resource.category ?? "",
      group_name: resource.group_name ?? "",
      link: resource.link,
      icon: resource.icon,
      accent: resource.accent,
      action_label: resource.action_label,
      permission_key: resource.permission_key,
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const saveResource = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isAdmin || !me?.id) return;

    if (!form.title.trim() || !form.link.trim()) {
      notify.error("El título y el enlace son obligatorios.");
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        const updated = await updateBranchResource(editing.id, form);
        setResources((current) =>
          current.map((resource) =>
            resource.id === updated.id ? updated : resource,
          ),
        );
        notify.success("Recurso actualizado.");
      } else {
        const maxOrder = resources.reduce(
          (maximum, resource) => Math.max(maximum, resource.sort_order),
          0,
        );

        const created = await createBranchResource({
          branchKey,
          sectionKey,
          input: form,
          currentUserId: me.id,
          sortOrder: maxOrder + 10,
        });

        setResources((current) => [...current, created]);
        notify.success("Recurso agregado.");
      }

      closeEditor();
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo guardar el recurso."));
    } finally {
      setSaving(false);
    }
  };

  const removeResource = async (resource: BranchResource) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `¿Eliminar “${resource.title}”? Esta acción quitará el recurso de la sucursal.`,
    );
    if (!confirmed) return;

    try {
      setDeletingId(resource.id);
      await deleteBranchResource(resource.id);
      setResources((current) =>
        current.filter((item) => item.id !== resource.id),
      );
      notify.success("Recurso eliminado.");
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo eliminar el recurso."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <section className="border-b border-slate-200/80 bg-[#f6f8fb] py-12 sm:py-16 lg:py-20">
        <Container>
          <div className="mb-9 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  {eyebrow}
                </span>
                <span
                  className="h-1 w-1 rounded-full bg-slate-300"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-slate-500">
                  Sucursal {branchName}
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[42px]">
                {title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                {description}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-[590px]">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                  aria-label="Buscar una herramienta"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Agregar recurso
                </button>
              ) : null}
            </div>
          </div>

          <div className="mb-7 flex items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleFilters.map((label) => {
              const Icon =
                label === "Todas"
                  ? LayoutGrid
                  : filterIcons[label] ?? SlidersHorizontal;
              const isActive = activeFilter === label;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveFilter(label)}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="grid min-h-[280px] place-items-center">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                Cargando recursos...
              </div>
            </div>
          ) : filteredProducts.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {filteredProducts.map((resource, index) => (
                <motion.div
                  layout
                  key={resource.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="relative"
                >
                  {isAdmin ? (
                    <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openEdit(resource);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white/95 text-slate-500 shadow-sm backdrop-blur transition hover:bg-slate-950 hover:text-white"
                        aria-label={`Editar ${resource.title}`}
                        title="Editar recurso"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === resource.id}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void removeResource(resource);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white/95 text-slate-400 shadow-sm backdrop-blur transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        aria-label={`Eliminar ${resource.title}`}
                        title="Eliminar recurso"
                      >
                        {deletingId === resource.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}

                  <CardSucursales
                    title={resource.title}
                    description={resource.description ?? undefined}
                    category={resource.category ?? undefined}
                    link={resource.link}
                    icon={resource.icon}
                    accent={resource.accent}
                    actionLabel={resource.action_label}
                    permissionKey={resource.permission_key ?? undefined}
                    variant="resource"
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                No encontramos herramientas
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {isAdmin && resources.length === 0
                  ? "Todavía no hay recursos cargados en esta sección."
                  : "Probá con otra búsqueda o seleccioná una categoría diferente."}
              </p>
              {isAdmin && resources.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Crear primer recurso
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveFilter("Todas");
                  }}
                  className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </Container>
      </section>

      <AnimatePresence>
        {editorOpen && isAdmin ? (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-md"
              onClick={closeEditor}
              aria-label="Cerrar editor"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.99 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-[26px] border border-white/70 bg-white p-6 shadow-[0_35px_100px_rgba(15,23,42,.25)] sm:p-7"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                    {editing ? "Editar recurso" : "Nuevo recurso"}
                  </div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {editing
                      ? editing.title
                      : `Agregar a ${branchName}`}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Se guardará directamente y aparecerá en esta sección.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={saveResource} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Título" className="sm:col-span-2">
                    <input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Ej. Seguimiento de cartera"
                      className="resource-input"
                    />
                  </Field>

                  <Field label="Categoría">
                    <input
                      value={form.category ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Ej. Cobertura"
                      className="resource-input"
                    />
                  </Field>

                  <Field label="Grupo">
                    <input
                      value={form.group_name ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          group_name: event.target.value,
                        }))
                      }
                      placeholder="Ventas, Reportes..."
                      className="resource-input"
                    />
                  </Field>

                  <Field label="Descripción" className="sm:col-span-2">
                    <textarea
                      rows={3}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Explicá brevemente para qué sirve."
                      className="resource-input resize-none py-3"
                    />
                  </Field>

                  <Field label="Enlace" className="sm:col-span-2">
                    <input
                      value={form.link}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          link: event.target.value,
                        }))
                      }
                      placeholder="https://..."
                      className="resource-input"
                    />
                  </Field>

                  <Field label="Icono">
                    <RedcomSelect
                      value={form.icon}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          icon: value as BranchResourceIcon,
                        }))
                      }
                      options={iconOptions}
                      className="h-11"
                    />
                  </Field>

                  <Field label="Color">
                    <RedcomSelect
                      value={form.accent}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          accent: value as BranchResourceAccent,
                        }))
                      }
                      options={accentOptions}
                      className="h-11"
                    />
                  </Field>

                  <Field label="Permiso asociado" className="sm:col-span-2">
                    <RedcomSelect
                      value={form.permission_key || "none"}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          permission_key:
                            value === "none"
                              ? null
                              : (value as ModulePermissionKey),
                        }))
                      }
                      options={permissionOptions}
                      className="h-11"
                    />
                    <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                      Si elegís un permiso, el recurso respetará automáticamente
                      la configuración de /admin/permisos.
                    </p>
                  </Field>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={saving}
                    className="h-11 rounded-xl px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editing ? (
                      <Pencil className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editing ? "Guardar cambios" : "Agregar recurso"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style jsx global>{`
        .resource-input {
          width: 100%;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding-left: 12px;
          padding-right: 12px;
          font-size: 13px;
          color: rgb(15 23 42);
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .resource-input::placeholder {
          color: rgb(148 163 184);
        }
        .resource-input:focus {
          border-color: rgb(148 163 184);
          box-shadow: 0 0 0 4px rgb(241 245 249);
        }
      `}</style>
    </>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
