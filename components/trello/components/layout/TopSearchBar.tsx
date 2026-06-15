import { Search } from 'lucide-react';
import { useBoards } from '../../context/BoardContext';

interface TopSearchBarProps {
  onCreateBoard: () => void;
}

export function TopSearchBar({ onCreateBoard }: TopSearchBarProps) {
  const { search, setSearch } = useBoards();

  return (
    <header className="grid h-[51px] grid-cols-[minmax(180px,1fr)_auto] items-center gap-2.5 border-b border-[#323338] bg-[#1d1d20] px-[17px] py-[7px] shadow-[0_1px_0_rgba(255,255,255,.03)]">
      <label className="flex h-9 items-center gap-2 rounded border border-[#828792] bg-[#18191b] px-2.5 text-[#b7bac3] focus-within:border-trello-blue focus-within:ring-1 focus-within:ring-trello-blue">
        <Search size={18} />
        <input
          className="w-full border-0 bg-transparent text-base text-[#d7d9df] outline-none placeholder:text-[#a3a7b0]"
          type="search"
          placeholder="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <button
        className="h-9 rounded bg-trello-blue px-4 text-base font-medium text-[#092957] transition hover:bg-[#85b8ff]"
        type="button"
        onClick={onCreateBoard}
      >
        Crear
      </button>
    </header>
  );
}
