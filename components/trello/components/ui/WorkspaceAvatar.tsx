import type { Workspace } from '../../types/trello';

interface WorkspaceAvatarProps {
  workspace: Workspace;
}

const colorClasses: Record<Workspace['color'], string> = {
  orange: 'bg-gradient-to-b from-[#ff7b6b] to-[#c94d00]',
  pink: 'bg-gradient-to-b from-[#f278ce] to-[#9e50c7]',
  red: 'bg-gradient-to-b from-[#ff6f57] to-[#b64a00]',
  blue: 'bg-gradient-to-b from-[#77aef7] to-[#2157a8]',
  green: 'bg-gradient-to-b from-[#7ddc9b] to-[#168357]',
  purple: 'bg-gradient-to-b from-[#b47cff] to-[#5a39be]',
};

export function WorkspaceAvatar({ workspace }: WorkspaceAvatarProps) {
  return (
    <span
      className={`inline-grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[5px] text-base font-semibold text-black shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)] ${colorClasses[workspace.color]}`}
    >
      {workspace.avatar}
    </span>
  );
}
