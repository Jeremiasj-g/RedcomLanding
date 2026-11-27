export const DEFAULT_CATEGORY_COLORS={SENIOR:'#065F46',SEMI_SENIOR:'#A7F3D0',JUNIOR:'#FDE68A',PLAN_MEJORA:'#FECACA'} as const;
export type CategoryColorKey=keyof typeof DEFAULT_CATEGORY_COLORS;
export type CategoryColors=Record<CategoryColorKey,string>;
export const CATEGORY_COLOR_KEYS=Object.keys(DEFAULT_CATEGORY_COLORS) as CategoryColorKey[];
export const CATEGORY_COLOR_LABELS={SENIOR:'Senior',SEMI_SENIOR:'Semi Senior',JUNIOR:'Junior',PLAN_MEJORA:'Plan de mejora'};
export const validHex=(v:string)=>/^#[0-9a-f]{6}$/i.test(v);
export function categoryHex(colors:CategoryColors,label:string|null|undefined){const k=(label??'').trim().toUpperCase().replace(/[_-]/g,' ').replace(/\s+/g,' ');return k==='SENIOR'?colors.SENIOR:k==='SEMI SENIOR'?colors.SEMI_SENIOR:k==='JUNIOR'?colors.JUNIOR:k==='PLAN DE MEJORA'||k==='PLAN MEJORA'?colors.PLAN_MEJORA:'#E2E8F0';}
export function contrastText(hex:string){const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]>.179?'#000000':'#FFFFFF';}
export function categoryStyle(colors:CategoryColors,label:string|null|undefined){const backgroundColor=categoryHex(colors,label);return {backgroundColor,color:contrastText(backgroundColor)};}
