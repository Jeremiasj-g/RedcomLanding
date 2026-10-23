'use client';
import Link from 'next/link';
import {useMe} from '@/hooks/useMe';
import {Clock3} from 'lucide-react';
export default function BranchSigoEntry({branchKey,href}:{branchKey:string;href:string}){
 const {me,loading}=useMe();
 if(loading||!me?.is_active||!(me.role==='admin'||(['supervisor','jdv'].includes(me.role)&&me.branches.includes(branchKey))))return null;
 return <div className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-8"><Link href={href} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"><Clock3 className="h-4 w-4"/>Horarios SIGO · Ver y corregir jornadas</Link></div>;
}
