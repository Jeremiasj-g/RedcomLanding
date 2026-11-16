import type {ReactNode} from 'react';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';

export default function Layout({children}:{children:ReactNode}){
 return <BranchCategoryV2Page scope={{
   key:'corrientes_refrigerados',userBranch:'refrigerados',branch:'CASA CENTRAL',force:'ESQUEMA REGRIGERADOS',
   label:'Refrigerados',basePath:'/corrientes/refrigerados/categorias-v2'
 }}>{children}</BranchCategoryV2Page>;
}
