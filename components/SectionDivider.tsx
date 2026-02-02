import React from "react";

type Props = {
  title: string;
  className?: string;
  children?: React.ReactNode; // por si querés meter tabs/chips al costado en el futuro
  icon?: React.ReactNode;     // opcional: podés pasar otro ícono
};

export function SectionDivider({ title, className = "", children, icon }: Props) {
  return (
    <div className={`flex items-center my-12 ${className}`}>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      <div className="mx-4 flex items-center z-10 gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 shadow-lg">
        {icon ?? <IconScale className="h-5 w-5 text-gray-700" />}
        <span className="text-2xl font-semibold text-gray-800">{title}</span>
      </div>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      {children}
    </div>
  );
}

function IconScale({ className = "w-5 h-5 text-gray-700" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 4-7 4-7-4 7-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 10l4 7H1l2-3 0-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 10l-4 7h6l-2-3 0-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
