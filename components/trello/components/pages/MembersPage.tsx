import { ChevronDown, HelpCircle, LogOut, UserPlus, X, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBoards } from '../../context/BoardContext';
import type { WorkspaceMember } from '../../types/trello';

const avatarClasses: Record<WorkspaceMember['avatarColor'], string> = {
  orange: 'bg-[#ff9f1a] text-[#172b4d]',
  red: 'bg-[#f4511e] text-white',
  blue: 'bg-[#579dff] text-[#092957]',
  green: 'bg-[#4bce97] text-[#092957]',
  purple: 'bg-[#9f8fef] text-white',
  yellow: 'bg-[#e2b203] text-[#172b4d]',
  teal: 'bg-[#60c6d2] text-[#092957]',
  pink: 'bg-[#f797d2] text-[#172b4d]',
};

function uniqueSystemUsers(members: WorkspaceMember[]) {
  const users = new Map<string, WorkspaceMember>();
  members.forEach((member) => {
    if (!users.has(member.username)) users.set(member.username, member);
  });
  return Array.from(users.values());
}

function MemberAvatar({ member }: { member: WorkspaceMember }) {
  return (
    <span
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${avatarClasses[member.avatarColor]}`}
    >
      {member.avatarText}
      <span className="absolute -bottom-0.5 right-0 grid h-3.5 w-3.5 place-items-center rounded-full border border-[#1d1d1f] bg-[#253858] text-[8px] text-[#579dff]">
        ^
      </span>
    </span>
  );
}

function MemberRow({ member, onRemove }: { member: WorkspaceMember; onRemove: (member: WorkspaceMember) => void }) {
  return (
    <article className="grid min-h-[63px] grid-cols-[minmax(260px,1fr)_minmax(190px,240px)_auto] items-center gap-4 border-b border-[#323338] py-3 text-[#d7d9df] max-lg:grid-cols-1 max-lg:items-start">
      <div className="flex min-w-0 items-center gap-3">
        <MemberAvatar member={member} />

        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-bold">
            {member.fullName} <span className="font-medium text-[#a6a8b0]">@{member.username}</span>
          </p>
        </div>
      </div>

      <p className="text-base text-[#dfe1e6]">Última actividad: {member.lastActivity}</p>

      <div className="flex justify-end gap-2 max-lg:flex-wrap max-lg:justify-start">
        <button className="inline-flex h-9 items-center gap-2 rounded border border-[#3c3f45] bg-transparent px-3 text-base font-semibold text-[#cdd1da] transition hover:bg-white/[.055]" type="button">
          Tableros ({member.boardCount}) <ChevronDown size={16} />
        </button>

        <button className="inline-flex h-9 items-center gap-2 rounded border border-[#3c3f45] bg-transparent px-3 text-base font-semibold text-[#cdd1da] transition hover:bg-white/[.055]" type="button">
          {member.role} <HelpCircle size={15} />
        </button>

        <button
          className="inline-flex h-9 min-w-[136px] items-center justify-center gap-2 rounded border border-[#3c3f45] bg-transparent px-3 text-base font-semibold text-[#cdd1da] transition hover:bg-white/[.055] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={member.isCurrentUser}
          onClick={() => onRemove(member)}
          title={member.isCurrentUser ? 'No podés quitarte desde esta maqueta' : 'Quitar miembro'}
        >
          {member.isCurrentUser ? <LogOut size={18} /> : <X size={19} />}
          {member.isCurrentUser ? 'Dejar' : 'Quitar'}
        </button>
      </div>
    </article>
  );
}

function WorkspaceInviteModal({
  open,
  users,
  workspaceMembers,
  onInvite,
  onRemove,
  onClose,
}: {
  open: boolean;
  users: WorkspaceMember[];
  workspaceMembers: WorkspaceMember[];
  onInvite: (userId: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const typeOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.userTypeName || 'Sin tipo').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [users],
  );
  const branchOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.branch || 'Sin sucursal').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [users],
  );
  const roleOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.systemRole || 'Sin rol').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [users],
  );

  if (!open) return null;

  const cleanQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const userType = user.userTypeName || 'Sin tipo';
    const userBranch = user.branch || 'Sin sucursal';
    const userRole = user.systemRole || 'Sin rol';
    const matchesQuery = `${user.fullName} ${user.username} ${user.avatarText} ${userType} ${userBranch} ${userRole}`
      .toLowerCase()
      .includes(cleanQuery);
    return (
      matchesQuery &&
      (typeFilter === 'all' || userType === typeFilter) &&
      (branchFilter === 'all' || userBranch === branchFilter) &&
      (roleFilter === 'all' || userRole === roleFilter)
    );
  });

  const selectClass = 'h-10 min-w-0 rounded-lg border border-[#3b4048] bg-[#17191c] px-3 text-xs font-bold text-[#dfe3ea] outline-none focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]';

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-16 z-[180] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#3b4048] bg-[#1f2024] text-[#dfe3ea] shadow-[0_24px_80px_rgba(0,0,0,.75)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#32363d] px-5 py-4">
          <div>
            <h2 className="text-lg font-black">Invitar miembros</h2>
            <p className="mt-1 text-sm text-[#aeb6c2]">Buscá usuarios del sistema y agregalos a este espacio de trabajo.</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg text-[#b6c2cf] transition hover:bg-white/10 hover:text-white" type="button" onClick={onClose} aria-label="Cerrar invitación">
            <X size={22} />
          </button>
        </header>

        <div className="p-5">
          <input
            className="h-11 w-full rounded-lg border border-[#7a818c] bg-[#17191c] px-3 text-sm text-[#f1f2f4] outline-none placeholder:text-[#aeb6c2] focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
            placeholder="Buscar usuarios por nombre, usuario, tipo, sucursal o rol..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />

          <div className="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#9fadbc]">Tipo de usuario</span>
              <select className={selectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Todos</option>
                {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#9fadbc]">Sucursal</span>
              <select className={selectClass} value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                <option value="all">Todas</option>
                {branchOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#9fadbc]">Rol</span>
              <select className={selectClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">Todos</option>
                {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 max-h-[50dvh] space-y-1 overflow-y-auto pr-1">
            {filteredUsers.map((user) => {
              const workspaceMember = workspaceMembers.find((member) => member.username === user.username);
              const selected = Boolean(workspaceMember);
              return (
                <button
                  key={user.id}
                  className="grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    if (selected && workspaceMember && !workspaceMember.isCurrentUser) void onRemove(workspaceMember.id);
                    if (!selected) void onInvite(user.id);
                  }}
                >
                  <MemberAvatar member={user} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#f1f2f4]">{user.fullName}</span>
                    <span className="block truncate text-xs text-[#aeb6c2]">@{user.username}</span>
                    <span className="mt-1 block truncate text-[11px] text-[#8f99a8]">
                      {[user.userTypeName, user.branch, user.systemRole].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                    </span>
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-black transition ${selected ? 'bg-[#1f6f4a] text-[#baf3db]' : 'bg-[#579dff] text-[#092957]'}`}>
                    {selected && <Check size={15} />}
                    {selected ? 'Invitado' : 'Añadir'}
                  </span>
                </button>
              );
            })}
            {filteredUsers.length === 0 && (
              <p className="rounded-lg bg-white/[.04] px-3 py-4 text-center text-sm text-[#aeb6c2]">No se encontraron usuarios.</p>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function MembersPage() {
  const {
    members,
    memberSearch,
    setActiveView,
    setMemberSearch,
    selectedWorkspaceId,
    inviteWorkspaceMember,
    removeWorkspaceMember,
  } = useBoards();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const workspaceMembers = useMemo(
    () => members.filter((member) => member.workspaceId === selectedWorkspaceId && member.status === 'member'),
    [members, selectedWorkspaceId],
  );

  const systemUsers = useMemo(() => uniqueSystemUsers(members), [members]);

  const visibleMembers = useMemo(() => {
    const search = memberSearch.trim().toLowerCase();
    return workspaceMembers.filter((member) =>
      search ? `${member.fullName} ${member.username}`.toLowerCase().includes(search) : true,
    );
  }, [memberSearch, workspaceMembers]);

  const handleInvite = async (userId: string) => {
    await inviteWorkspaceMember(selectedWorkspaceId, userId);
  };

  const handleRemove = async (member: WorkspaceMember) => {
    if (member.isCurrentUser) {
      window.alert('No podés quitar tu propio usuario desde esta maqueta.');
      return;
    }

    const confirmed = window.confirm(`¿Querés quitar a ${member.fullName} de este espacio de trabajo?`);
    if (!confirmed) return;
    await removeWorkspaceMember(member.id);
  };

  const handleRemoveById = async (memberId: string) => {
    const member = workspaceMembers.find((currentMember) => currentMember.id === memberId);
    if (!member) return;
    await handleRemove(member);
  };

  return (
    <main className="relative h-full min-h-0 overflow-y-auto min-w-0 bg-[#1e1e21] px-[38px] py-11 text-[#d7d9df]">
      <button
        className="absolute right-6 top-3 grid h-12 w-12 place-items-center rounded-full border border-[#323338] text-[#a6a8b0] transition hover:bg-white/[.055] hover:text-white"
        type="button"
        aria-label="Cerrar colaboradores"
        onClick={() => setActiveView('boards')}
      >
        <X size={25} />
      </button>

      <section className="max-w-[1440px]">
        <header className="mb-[18px] flex items-center gap-2">
          <h1 className="text-[28px] font-bold leading-none text-[#d7d9df]">Colaboradores</h1>
        </header>

        <div className="border-b border-[#323338]">
          <button className="border-b-2 border-trello-blue pb-2 text-base font-semibold text-trello-blue" type="button">
            Miembros ({workspaceMembers.length})
          </button>
        </div>

        <div className="flex items-start justify-between gap-6 border-b border-[#323338] py-[18px] max-lg:flex-col">
          <p className="max-w-[990px] text-base leading-snug text-white">
            Los miembros del Espacio de trabajo pueden ver todos los tableros visibles para el Espacio de trabajo,
            unirse a ellos y crear nuevos tableros en el Espacio de trabajo.
          </p>

          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded bg-trello-blue px-4 text-base font-semibold text-[#092957] transition hover:bg-[#85b8ff]"
            type="button"
            onClick={() => setInviteModalOpen(true)}
          >
            <UserPlus size={18} />
            Invitar a miembros del Espacio de trabajo
          </button>
        </div>

        <div className="border-b border-[#323338] py-[17px]">
          <input
            className="h-10 w-[330px] max-w-full rounded border border-[#6a6f7a] bg-[#1f2024] px-3 text-base text-[#d7d9df] outline-none transition placeholder:text-[#a6a8b0] focus:border-trello-blue focus:ring-1 focus:ring-trello-blue"
            type="search"
            placeholder="Filtrar por nombre"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
          />
        </div>

        <div>
          {visibleMembers.map((member) => (
            <MemberRow key={member.id} member={member} onRemove={handleRemove} />
          ))}

          {visibleMembers.length === 0 && (
            <div className="rounded-b-lg border-b border-[#323338] py-8 text-[#a6a8b0]">
              No encontramos colaboradores con ese filtro.
            </div>
          )}
        </div>
      </section>

      <WorkspaceInviteModal
        open={inviteModalOpen}
        users={systemUsers}
        workspaceMembers={workspaceMembers}
        onInvite={handleInvite}
        onRemove={handleRemoveById}
        onClose={() => setInviteModalOpen(false)}
      />
    </main>
  );
}
