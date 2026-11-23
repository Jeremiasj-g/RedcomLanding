import { supabase } from '@/lib/supabaseClient';

export type CategoryScaleKey='general'|'refrigerados';
export type CategoryScaleSettings = {
  title: string;
  validYear: number;
  percentTolerance: number;
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

export async function fetchCategoryScaleConfig(scaleKey:CategoryScaleKey='general'): Promise<{
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
      .select('title,valid_year,percent_tolerance')
      .eq('id',scaleKey==='refrigerados'?2:1)
      .single(),
    supabase
      .from('category_scale_metrics')
      .select(
        'id,section_name,metric_name,value_type,senior_value,semi_senior_value,junior_value,improvement_value,weight_percent,sort_order',
      )
      .eq('is_active', true)
      .eq('scale_key',scaleKey)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('category_scale_gates')
      .select('id,label,value_text,sort_order')
      .eq('is_active', true)
      .eq('scale_key',scaleKey)
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
      percentTolerance: Number(settings?.percent_tolerance ?? 1),
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
  scaleKey:CategoryScaleKey='general',
): Promise<void> {
  if(!Number.isFinite(settings.percentTolerance)||settings.percentTolerance<0||settings.percentTolerance>10)throw new Error('La tolerancia debe estar entre 0 y 10 puntos porcentuales.');
  const { error } = await supabase
    .from('category_scale_settings')
    .update({
      title: settings.title.trim(),
      valid_year: settings.validYear,
      percent_tolerance: settings.percentTolerance,
    })
    .eq('id',scaleKey==='refrigerados'?2:1);

  if (error) throw error;
}

export async function createCategoryScaleMetric(
  input: CategoryScaleMetricInput,
  scaleKey:CategoryScaleKey='general',
): Promise<CategoryScaleMetric> {
  const { data, error } = await supabase
    .from('category_scale_metrics')
    .insert({
      section_name: input.sectionName.trim(),
      scale_key:scaleKey,
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
  scaleKey:CategoryScaleKey='general',
): Promise<CategoryScaleMetric> {
  const { data, error } = await supabase
    .from('category_scale_metrics')
    .update({
      section_name: input.sectionName.trim(),
      scale_key:scaleKey,
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
    .eq('scale_key',scaleKey)
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

export async function deleteCategoryScaleMetric(id: number,scaleKey:CategoryScaleKey='general'): Promise<void> {
  const { error } = await supabase
    .from('category_scale_metrics')
    .delete()
    .eq('id', id)
    .eq('scale_key',scaleKey);

  if (error) throw error;
}

export async function createCategoryScaleGate(
  input: CategoryScaleGateInput,
  scaleKey:CategoryScaleKey='general',
): Promise<CategoryScaleGate> {
  const { data, error } = await supabase
    .from('category_scale_gates')
    .insert({
      label: input.label.trim(),
      scale_key:scaleKey,
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
  scaleKey:CategoryScaleKey='general',
): Promise<CategoryScaleGate> {
  const { data, error } = await supabase
    .from('category_scale_gates')
    .update({
      label: input.label.trim(),
      scale_key:scaleKey,
      value_text: input.valueText.trim(),
      sort_order: input.sortOrder,
    })
    .eq('id', id)
    .eq('scale_key',scaleKey)
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

export async function deleteCategoryScaleGate(id: number,scaleKey:CategoryScaleKey='general'): Promise<void> {
  const { error } = await supabase
    .from('category_scale_gates')
    .delete()
    .eq('id', id)
    .eq('scale_key',scaleKey);

  if (error) throw error;
}
