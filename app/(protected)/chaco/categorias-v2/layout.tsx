import type {ReactNode} from 'react';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';

export default function Layout({children}:{children:ReactNode}){
 return <BranchCategoryV2Page scope={{
   key:'chaco',userBranch:'chaco',branch:'SUCURSAL RESISTENCIA',force:'all',
   label:'Resistencia',basePath:'/chaco/categorias-v2'
 }}>{children}</BranchCategoryV2Page>;
}
