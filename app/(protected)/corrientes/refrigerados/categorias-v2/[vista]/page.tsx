import {notFound} from 'next/navigation';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';
export default async function Page({params}:{params:{vista:string}}){
 const {vista}=params;
 if(vista!=='categorias'&&vista!=='horarios-sigo')notFound();
 return <BranchCategoryV2Page scope={{key:'corrientes_refrigerados',userBranch:'refrigerados',branch:'CASA CENTRAL',force:'ESQUEMA REGRIGERADOS',label:'Refrigerados',basePath:'/corrientes/refrigerados/categorias-v2'}} view={vista}/>;
}
