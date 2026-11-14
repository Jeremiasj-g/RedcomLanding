import {notFound} from 'next/navigation';
export default function Page({params}:{params:{vista:string}}){
 if(params.vista!=='categorias'&&params.vista!=='horarios-sigo')notFound();
 return null;
}
