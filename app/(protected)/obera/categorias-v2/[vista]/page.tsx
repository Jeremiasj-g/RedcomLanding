import {notFound} from 'next/navigation';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';
export default async function Page({params}:{params:{vista:string}}){
 const {vista}=params;
 if(vista!=='categorias'&&vista!=='horarios-sigo')notFound();
 return <BranchCategoryV2Page scope={{key:'obera',userBranch:'obera',branch:'SUCURSAL OBERA',force:'all',label:'Oberá',basePath:'/obera/categorias-v2'}} view={vista}/>;
}
