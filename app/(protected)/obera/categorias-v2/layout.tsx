import type {ReactNode} from 'react';
import BranchCategoryV2Page from '@/components/category-panel/BranchCategoryV2Page';

export default function Layout({children}:{children:ReactNode}){
 return <BranchCategoryV2Page scope={{
   key:'obera',userBranch:'obera',branch:'SUCURSAL OBERA',force:'all',
   label:'Oberá',basePath:'/obera/categorias-v2'
 }}>{children}</BranchCategoryV2Page>;
}
