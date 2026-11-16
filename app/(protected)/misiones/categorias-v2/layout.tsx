import type {ReactNode} from 'react';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';

export default function Layout({children}:{children:ReactNode}){
 return <BranchCategoryV2Page scope={{
   key:'misiones',userBranch:'misiones',branch:'SUCURSAL POSADAS',force:'all',
   label:'Posadas',basePath:'/misiones/categorias-v2'
 }}>{children}</BranchCategoryV2Page>;
}
