export type FocoSeverity = 'info' | 'warning' | 'critical';
export type FocoType = 'foco' | 'critico' | 'promo' | 'capacitacion';

export type FocoTarget = {
  branch_id: number;
  branch_name: string;
};

export type FocoRow = {
  id: string;
  title: string;
  content: string;
  severity: FocoSeverity;
  type: FocoType;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;

  targets: FocoTarget[];
  target_branches_count: number;
  target_users_count: number;
  completed_count: number;
  completion_rate: number;
};
