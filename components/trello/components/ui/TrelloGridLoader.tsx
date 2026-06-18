export function TrelloGridLoader({ label = 'Cargando tableros...' }: { label?: string }) {
  return (
    <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-[#323338] bg-[#242528] p-8 text-[#a6a8b0]">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-14 w-14 grid-cols-2 grid-rows-2 gap-1.5 rounded-2xl border border-white/10 bg-[#22252b] p-2 shadow-2xl">
          <span className="animate-[trello-loader_1.1s_ease-in-out_infinite] rounded-md bg-[#579dff]" />
          <span className="animate-[trello-loader_1.1s_ease-in-out_.12s_infinite] rounded-md bg-[#85b8ff]" />
          <span className="animate-[trello-loader_1.1s_ease-in-out_.24s_infinite] rounded-md bg-[#9f8fef]" />
          <span className="animate-[trello-loader_1.1s_ease-in-out_.36s_infinite] rounded-md bg-[#4bce97]" />
        </div>
        <p className="text-sm font-black text-[#c9d0dc]">{label}</p>
      </div>
    </div>
  );
}
