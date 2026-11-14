import {notFound} from 'next/navigation';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';
export default async function Page({params}:{params:{vista:string}}){
 const {vista}=params;
 if(vista!=='categorias'&&vista!=='horarios-sigo')notFound();
 return <BranchCategoryV2Page scope={{key:'corrientes_masivos',userBranch:'corrientes',branch:'CASA CENTRAL',force:'ESQUEMA 1',label:'Corrientes Masivos',basePath:'/corrientes/masivos/categorias-v2'}} view={vista}/>;
}
