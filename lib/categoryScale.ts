import { supabase } from '@/lib/supabaseClient';

export type CategoryScaleSettings = {
  title: string;
  validYear: number;
};

export type CategoryScaleValueType = 'number' | 'percent' | 'currency' | 'count';

export type CategoryScaleMetric = {
  id: number;
  sectionName: string;
  metricName: string;
  valueType: CategoryScaleValueType;
  seniorValue: number | null;
  semiSeniorValue: number | null;
  juniorValue: number | null;
  improvementValue: number | null;
  weightPercent: number;
  sortOrder: number;
};

export type CategoryScaleGate = {
  id: number;
  label: string;
  valueText: string;
  sortOrder: number;
};

export type CategoryScaleMetricInput = Omit<CategoryScaleMetric, 'id'>;
export type CategoryScaleGateInput = Omit<CategoryScaleGate, 'id'>;

export async function fetchCategoryScaleConfig(): Promise<{
  settings: CategoryScaleSettings;
  metrics: CategoryScaleMetric[];
  gates: CategoryScaleGate[];
}> {
  const [
    { data: settings, error: settingsError },
    { data: metrics, error: metricsError },
    { data: gates, error: gatesError },
  ] = await Promise.all([
    supabase
      .from('category_scale_settings')
      .select('title,valid_year')
      .eq('id', 1)
      .single(),
    supabase
      .from('category_scale_metrics')
      .select(
        'id,section_name,metric_name,value_type,senior_value,semi_senior_value,junior_value,improvement_value,weight_percent,sort_order',
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('category_scale_gates')
      .select('id,label,value_text,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (settingsError) throw settingsError;
  if (metricsError) throw metricsError;
  if (gatesError) throw gatesError;

  return {
    settings: {
      title: String(settings?.title ?? 'Escalas categorización preventa'),
      validYear: Number(settings?.valid_year ?? new Date().getFullYear()),
    },
    metrics: (metrics ?? []).map((row: any) => ({
      id: Number(row.id),
      sectionName: String(row.section_name),
      metricName: String(row.metric_name),
      valueType: String(row.value_type ?? 'number') as CategoryScaleValueType,
      seniorValue: row.senior_value === null ? null : Number(row.senior_value),
      semiSeniorValue:
        row.semi_senior_value === null ? null : Number(row.semi_senior_value),
      juniorValue: row.junior_value === null ? null : Number(row.junior_value),
      improvementValue:
        row.improvement_value === null ? null : Number(row.improvement_value),
      weightPercent: Number(row.weight_percent ?? 0),
      sortOrder: Number(row.sort_order ?? 0),
    })),
    gates: (gates ?? []).map((row: any) => ({
      id: Number(row.id),
      label: String(row.label),
      valueText: String(row.value_text),
      sortOrder: Number(row.sort_order ?? 0),
    })),
  };
}

export async function updateCategoryScaleSettings(
  settings: CategoryScaleSettings,
): Promise<void> {
  const { error } = await supabase
    .from('category_scale_settings')
    .update({
      title: settings.title.trim(),
      valid_year: settings.validYear,
    })
    .eq('id', 1);

  if (error) throw error;
}

export async function createCategoryScaleMetric(
  input: CategoryScaleMetricInput,
): Promise<CategoryScaleMetric> {
  const { data, error } = await supabase
    .from('category_scale_metrics')
    .insert({
      section_name: input.sectionName.trim(),
      metric_name: input.metricName.trim(),
      value_type: input.valueType,
      senior_value: input.seniorValue,
      semi_senior_value: input.semiSeniorValue,
      junior_value: input.juniorValue,
      improvement_value: input.improvementValue,
      weight_percent: input.weightPercent,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: Number(data.id),
    sectionName: String(data.section_name),
    metricName: String(data.metric_name),
    valueType: String(data.value_type ?? 'number') as CategoryScaleValueType,
    seniorValue: data.senior_value === null ? null : Number(data.senior_value),
    semiSeniorValue:
      data.semi_senior_value === null ? null : Number(data.semi_senior_value),
    juniorValue: data.junior_value === null ? null : Number(data.junior_value),
    improvementValue:
      data.improvement_value === null ? null : Number(data.improvement_value),
    weightPercent: Number(data.weight_percent ?? 0),
    sortOrder: Number(data.sort_order ?? 0),
  };
}

export async function updateCategoryScaleMetric(
  id: number,
  input: CategoryScaleMetricInput,
): Promise<CategoryScaleMetric> {
  const { data, error } = await supabase
    .from('category_scale_metrics')
    .update({
      section_name: input.sectionName.trim(),
      metric_name: input.metricName.trim(),
      value_type: input.valueType,
      senior_value: input.seniorValue,
      semi_senior_value: input.semiSeniorValue,
      junior_value: input.juniorValue,
      improvement_value: input.improvementValue,
      weight_percent: input.weightPercent,
      sort_order: input.sortOrder,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: Number(data.id),
    sectionName: String(data.section_name),
    metricName: String(data.metric_name),
    valueType: String(data.value_type ?? 'number') as CategoryScaleValueType,
    seniorValue: data.senior_value === null ? null : Number(data.senior_value),
    semiSeniorValue:
      data.semi_senior_value === null ? null : Number(data.semi_senior_value),
    juniorValue: data.junior_value === null ? null : Number(data.junior_value),
    improvementValue:
      data.improvement_value === null ? null : Number(data.improvement_value),
    weightPercent: Number(data.weight_percent ?? 0),
    sortOrder: Number(data.sort_order ?? 0),
  };
}

export async function deleteCategoryScaleMetric(id: number): Promise<void> {
  const { error } = await supabase
    .from('category_scale_metrics')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createCategoryScaleGate(
  input: CategoryScaleGateInput,
): Promise<CategoryScaleGate> {
  const { data, error } = await supabase
    .from('category_scale_gates')
    .insert({
      label: input.label.trim(),
      value_text: input.valueText.trim(),
      sort_order: input.sortOrder,
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: Number(data.id),
    label: String(data.label),
    valueText: String(data.value_text),
    sortOrder: Number(data.sort_order ?? 0),
  };
}

export async function updateCategoryScaleGate(
  id: number,
  input: CategoryScaleGateInput,
): Promise<CategoryScaleGate> {
  const { data, error } = await supabase
    .from('category_scale_gates')
    .update({
      label: input.label.trim(),
      value_text: input.valueText.trim(),
      sort_order: input.sortOrder,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: Number(data.id),
    label: String(data.label),
    valueText: String(data.value_text),
    sortOrder: Number(data.sort_order ?? 0),
  };
}

export async function deleteCategoryScaleGate(id: number): Promise<void> {
  const { error } = await supabase
    .from('category_scale_gates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
