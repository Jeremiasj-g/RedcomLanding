import { Globe2, LockKeyhole, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useBoards } from '../../context/BoardContext';
import type { WorkspaceVisibility } from '../../types/trello';

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

const visibilityOptions: Array<{
  value: WorkspaceVisibility;
  title: string;
  description: string;
  icon: typeof LockKeyhole;
}> = [
  {
    value: 'privado',
    title: 'Privado',
    description: 'Solo los miembros invitados podrán ver este espacio de trabajo.',
    icon: LockKeyhole,
  },
  {
    value: 'publico',
    title: 'Público',
    description: 'Los miembros del equipo podrán encontrarlo y solicitar acceso.',
    icon: Globe2,
  },
];

export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const { createWorkspace } = useBoards();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<WorkspaceVisibility>('privado');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setVisibility('privado');
      setIsSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();

    if (!cleanName || isSaving) return;

    setIsSaving(true);
    try {
      await createWorkspace({ name: cleanName, visibility });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-16 z-[180] grid place-items-center overflow-y-auto bg-black/60 px-4 py-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="mx-auto max-h-[calc(100dvh-96px)] w-full max-w-[430px] overflow-y-auto rounded-xl border border-[#323338] bg-[#25262a] p-4 text-[#d7d9df] shadow-[0_20px_60px_rgba(0,0,0,.58)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <div className="mb-4 grid grid-cols-[32px_minmax(0,1fr)_32px] items-center">
          <span />
          <h2 id="create-workspace-title" className="text-center text-base font-black">
            Crear espacio de trabajo
          </h2>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md text-[#a6a8b0] transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#d7d9df]">Nombre del espacio de trabajo</span>
            <input
              autoFocus
              className="h-10 w-full rounded border border-[#6a6f7a] bg-[#1f2024] px-3 text-sm text-[#d7d9df] outline-none transition placeholder:text-[#878a93] focus:border-trello-blue focus:ring-1 focus:ring-trello-blue"
              type="text"
              placeholder="Ej. Redcom, Facultad, Proyecto final..."
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <fieldset>
            <legend className="mb-2 block text-sm font-black text-[#d7d9df]">Visibilidad</legend>
            <div className="grid gap-2">
              {visibilityOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = visibility === option.value;

                return (
                  <button
                    key={option.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? 'border-trello-blue bg-[#1f3555] text-white'
                        : 'border-[#3b3d43] bg-[#1f2024] text-[#c9cbd2] hover:border-[#6a6f7a] hover:bg-[#292b30]'
                    }`}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                  >
                    <Icon className="mt-0.5 shrink-0" size={18} />
                    <span>
                      <span className="block text-sm font-black">{option.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-[#aeb2bc]">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button
            className="h-10 w-full rounded bg-trello-blue font-bold text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:bg-[#3b587a] disabled:text-[#a6a8b0]"
            type="submit"
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? 'Creando...' : 'Crear espacio de trabajo'}
          </button>
        </form>
      </div>
    </div>
  );
}
