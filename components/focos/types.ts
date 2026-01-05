export type FocoSeverity = 'info' | 'warning' | 'critical';
export type FocoType = 'foco' | 'critico' | 'promo' | 'capacitacion';

export type Foco = {
  id: string;
  title: string;
  content: string;
  severity: FocoSeverity;
  type: FocoType;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;

  foco_assets?: FocoAsset[];
};

export type FocoAssetKind = 'image' | 'pdf' | 'video';

export type FocoAsset = {
  id: number;
  foco_id: string;
  kind: FocoAssetKind;
  url: string;
  label: string | null;
  created_by: string;
  created_at: string;
};

export type Branch = {
  id: number;
  name: string; // ⚠️ si tu tabla branches usa otro nombre, cambialo acá y en el fetch.
};

export type FocoCompletion = {
  foco_id: string;
  completed_at: string;
  branch_id: number | null;
};
