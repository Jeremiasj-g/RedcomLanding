export type BranchKey =
  | 'corrientes_masivos'
  | 'corrientes_refrigerados'
  | 'chaco_masivos'
  | 'misiones_masivos'
  | 'obera_masivos';

export const SHEETDB_ENDPOINTS: Record<BranchKey, string> = {
  corrientes_masivos: 'https://sheetdb.io/api/v1/r9qt6cnvza9pn',
  corrientes_refrigerados: '',
  chaco_masivos: 'https://sheetdb.io/api/v1/lkcauysqy3qdh',
  misiones_masivos: 'https://sheetdb.io/api/v1/ewj2zvbo6ki6s',
  obera_masivos: '',
};
