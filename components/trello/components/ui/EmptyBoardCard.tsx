interface EmptyBoardCardProps {
  boardsCount: number;
  onClick: () => void;
}

export function EmptyBoardCard({ onClick }: EmptyBoardCardProps) {
  return (
    <button
      className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-lg bg-[#2b2c30] text-center text-[#c3c5cc] transition hover:bg-[#34363b]"
      type="button"
      onClick={onClick}
    >
      <span className="text-base">Crear un tablero nuevo</span>
    </button>
  );
}
