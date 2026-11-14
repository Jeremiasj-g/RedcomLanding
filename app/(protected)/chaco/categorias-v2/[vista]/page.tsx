import {notFound} from 'next/navigation';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';
export default async function Page({params}:{params:{vista:string}}){
 const {vista}=params;
 if(vista!=='categorias'&&vista!=='horarios-sigo')notFound();
 return <BranchCategoryV2Page scope={{key:'chaco',userBranch:'chaco',branch:'SUCURSAL RESISTENCIA',force:'all',label:'Resistencia',basePath:'/chaco/categorias-v2'}} view={vista}/>;
}
