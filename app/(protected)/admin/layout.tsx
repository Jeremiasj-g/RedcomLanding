import { Users, UserPlus, ClipboardList } from 'lucide-react';
import RequireAdmin from '@/app/auth/RequireAdmin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <div className="mx-auto flex flex-col max-w-7xl gap-6 px-4 py-8">
        <aside className="flex gap-6">
          <a href="/admin" className="flex items-center gap-2 rounded-xl border px-6 py-4 bg-gray-800 text-white font-semibold shadow-lg hover:bg-gray-800 hover:scale-105 transition-all duration-150">
            <Users className="w-5 h-5" />
            Usuarios
          </a>
          <a href="/admin/new" className="flex items-center gap-2 rounded-xl border px-6 py-4 bg-gray-800 text-white font-semibold shadow-lg hover:bg-gray-800 hover:scale-105 transition-all duration-150">
            <UserPlus className="w-5 h-5" />
            Crear usuario
          </a>
          <a href="/admin/solicitudes" className="flex items-center gap-2 rounded-xl border px-6 py-4 bg-gray-800 text-white font-semibold shadow-lg hover:bg-gray-800 hover:scale-105 transition-all duration-150">
            <ClipboardList className="w-5 h-5" />
            Solicitudes
          </a>
        </aside>
        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </RequireAdmin>
  );
}