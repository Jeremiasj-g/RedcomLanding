import type {CommercialPerson} from '@/lib/commercialPersonnelMaster';

export type PersonnelChangeStatus='new'|'modified'|'removed';
export type PersonnelImportChange={
 branch:string;person_code:number;status:PersonnelChangeStatus;
 previous_person:CommercialPerson|null;current_person:CommercialPerson|null;
};
const key=(p:Pick<CommercialPerson,'branch'|'id'>)=>JSON.stringify([p.branch,p.id]);
const equivalent=(a:CommercialPerson,b:CommercialPerson)=>
 a.id===b.id&&a.branch===b.branch&&a.name===b.name&&
 a.role===b.role&&a.superior===b.superior&&a.force===b.force;

/** Compare by (branch, code), never name. A changed name may mean code reuse. */
export function compareCommercialPersonnel(previous:CommercialPerson[],next:CommercialPerson[]):PersonnelImportChange[]{
 const old=new Map(previous.map(p=>[key(p),p]));
 const current=new Map(next.map(p=>[key(p),p]));
 const changes:PersonnelImportChange[]=[];
 for(const [id,person] of current){
  const before=old.get(id);
  if(!before)changes.push({branch:person.branch,person_code:person.id,status:'new',previous_person:null,current_person:person});
  else if(!equivalent(before,person))changes.push({branch:person.branch,person_code:person.id,status:'modified',previous_person:before,current_person:person});
 }
 for(const [id,person] of old){
  if(!current.has(id))changes.push({branch:person.branch,person_code:person.id,status:'removed',previous_person:person,current_person:null});
 }
 return changes;
}
export function changesByKey(changes:PersonnelImportChange[]){
 return new Map(changes.filter(c=>c.status!=='removed').map(c=>[JSON.stringify([c.branch,c.person_code]),c.status]));
}
