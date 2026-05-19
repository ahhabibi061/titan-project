import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface NutritionLog {
  id: string;
  meal_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'uncategorized';
  source: 'manual' | 'vision_api' | 'barcode';
  confidence: number | null;
  logged_at: string;
  serving_amount: number | null;
  serving_unit: string | null;
  // micronutrients
  sodium_mg?: number | null;
  potassium_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  vitamin_c_mg?: number | null;
  vitamin_d_iu?: number | null;
  magnesium_mg?: number | null;
  zinc_mg?: number | null;
  saturated_fat_g?: number | null;
  sugar_g?: number | null;
  cholesterol_mg?: number | null;
}

export interface WaterLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

export interface DailyNutrition {
  logs: NutritionLog[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
}

export interface WaterDay {
  logs: WaterLog[];
  total_ml: number;
}

export interface FoodResult {
  fdcId: number;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  // micros — populated from USDA when available
  sodium_mg?: number;
  potassium_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  vitamin_c_mg?: number;
  vitamin_d_iu?: number;
  magnesium_mg?: number;
  zinc_mg?: number;
  saturated_fat_g?: number;
  sugar_g?: number;
  cholesterol_mg?: number;
  fromHistory?: boolean;
  count?: number;
}

export interface MostLoggedFood {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  count: number;
}

export interface ScanResult {
  meal_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function localDayRange(date: string) {
  const start = new Date(date + 'T00:00:00');
  const end   = new Date(date + 'T23:59:59.999');
  return { start: start.toISOString(), end: end.toISOString() };
}

// ── useDailyNutrition ─────────────────────────────────────────────────────

export function useDailyNutrition(date: string) {
  return useQuery<DailyNutrition>({
    queryKey: ['nutrition', date],
    queryFn: async () => {
      const userId = await getUserId();
      const { start, end } = localDayRange(date);
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lte('logged_at', end)
        .order('logged_at', { ascending: true });
      if (error) throw error;
      const logs = (data ?? []) as NutritionLog[];
      const totals = logs.reduce(
        (acc, l) => ({
          kcal:    acc.kcal    + (l.kcal     ?? 0),
          protein: acc.protein + (l.protein_g ?? 0),
          carbs:   acc.carbs   + (l.carbs_g   ?? 0),
          fat:     acc.fat     + (l.fat_g     ?? 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      );
      return { logs, totals };
    },
    staleTime: 30_000,
  });
}

// ── useNutritionHistory ────────────────────────────────────────────────────

export function useNutritionHistory() {
  return useQuery({
    queryKey: ['nutrition-history'],
    queryFn: async () => {
      const userId = await getUserId();
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('kcal, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', since.toISOString())
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ── useLogMeal ────────────────────────────────────────────────────────────

export function useLogMeal() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (entry: {
      meal_name: string;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      meal_type: string;
      source?: string;
      confidence?: number;
      serving_amount?: number;
      serving_unit?: string;
      sodium_mg?: number;
      potassium_mg?: number;
      calcium_mg?: number;
      iron_mg?: number;
      vitamin_c_mg?: number;
      vitamin_d_iu?: number;
      magnesium_mg?: number;
      zinc_mg?: number;
      saturated_fat_g?: number;
      sugar_g?: number;
      cholesterol_mg?: number;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase.from('nutrition_logs').insert({
        user_id:    userId,
        ...entry,
        source:     entry.source ?? 'manual',
        logged_at:  new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nutrition'] });
      qc.refetchQueries({ queryKey: ['nutrition'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return { logMeal: mutation.mutateAsync, isLoading: mutation.isPending, error: mutation.error };
}

// ── useDeleteMeal ─────────────────────────────────────────────────────────

export function useDeleteMeal() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nutrition_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nutrition'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return { deleteMeal: mutation.mutateAsync, isLoading: mutation.isPending };
}

// ── useWaterLog ───────────────────────────────────────────────────────────

export function useWaterLog(date: string) {
  return useQuery<WaterDay>({
    queryKey: ['water', date],
    queryFn: async () => {
      const userId = await getUserId();
      const { start, end } = localDayRange(date);
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, amount_ml, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lte('logged_at', end)
        .order('logged_at', { ascending: true });
      if (error) throw error;
      const logs = (data ?? []) as WaterLog[];
      const total_ml = logs.reduce((sum, l) => sum + l.amount_ml, 0);
      return { logs, total_ml };
    },
    staleTime: 30_000,
  });
}

// ── useLogWater ───────────────────────────────────────────────────────────

export function useLogWater() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (amount_ml: number) => {
      const userId = await getUserId();
      const { error } = await supabase.from('water_logs').insert({
        user_id:   userId,
        amount_ml,
        logged_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['water'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return { logWater: mutation.mutateAsync, isLoading: mutation.isPending };
}

// ── useDeleteWater ────────────────────────────────────────────────────────

export function useDeleteWater() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('water_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['water'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return { deleteWater: mutation.mutateAsync };
}

// ── useScanMeal ───────────────────────────────────────────────────────────

export function useScanMeal() {
  const mutation = useMutation({
    mutationFn: async (): Promise<ScanResult> => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error('Camera permission denied');

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) throw new Error('Cancelled');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-meal-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ image: result.assets[0].base64 }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new Error(err.message ?? 'Scan failed');
      }
      return res.json() as Promise<ScanResult>;
    },
  });
  return { scanMeal: mutation.mutateAsync, isLoading: mutation.isPending, error: mutation.error };
}

// ── useFoodSearch ─────────────────────────────────────────────────────────

const USDA_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';

function extractNutrient(nutrients: any[], id: number): number {
  return Math.round(nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0);
}

function extractMicro(nutrients: any[], id: number): number | undefined {
  const val = nutrients.find((n: any) => n.nutrientId === id)?.value;
  return val != null && val > 0 ? Math.round(val * 100) / 100 : undefined;
}

export function useFoodSearch(query: string) {
  return useQuery<FoodResult[]>({
    queryKey: ['food-search', query],
    queryFn: async () => {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=25&api_key=${USDA_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json() as any;
      return (data.foods ?? []).map((f: any) => ({
        fdcId:     f.fdcId,
        name:      f.description,
        kcal:      extractNutrient(f.foodNutrients, 1008),
        protein_g: extractNutrient(f.foodNutrients, 1003),
        carbs_g:   extractNutrient(f.foodNutrients, 1005),
        fat_g:     extractNutrient(f.foodNutrients, 1004),
        sodium_mg:       extractMicro(f.foodNutrients, 1093),
        potassium_mg:    extractMicro(f.foodNutrients, 1092),
        calcium_mg:      extractMicro(f.foodNutrients, 1087),
        iron_mg:         extractMicro(f.foodNutrients, 1089),
        vitamin_c_mg:    extractMicro(f.foodNutrients, 1162),
        vitamin_d_iu:    extractMicro(f.foodNutrients, 1114),
        magnesium_mg:    extractMicro(f.foodNutrients, 1090),
        zinc_mg:         extractMicro(f.foodNutrients, 1095),
        saturated_fat_g: extractMicro(f.foodNutrients, 1258),
        sugar_g:         extractMicro(f.foodNutrients, 2000),
        cholesterol_mg:  extractMicro(f.foodNutrients, 1253),
      })) as FoodResult[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

// ── useMostLoggedFoods ────────────────────────────────────────────────────

export function useMostLoggedFoods() {
  return useQuery<MostLoggedFood[]>({
    queryKey: ['most-logged-foods'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data } = await supabase
        .from('nutrition_logs')
        .select('meal_name, kcal, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .not('meal_name', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(300);
      const map = new Map<string, MostLoggedFood>();
      for (const row of data ?? []) {
        const key = (row.meal_name ?? '').toLowerCase().trim();
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, { name: row.meal_name, kcal: row.kcal ?? 0, protein_g: row.protein_g ?? 0, carbs_g: row.carbs_g ?? 0, fat_g: row.fat_g ?? 0, count: 1 });
        } else {
          map.get(key)!.count++;
        }
      }
      return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    },
    staleTime: 2 * 60_000,
  });
}

// ── searchFoodHistory (exported async helper for inline use) ──────────────

export async function searchFoodHistory(query: string): Promise<MostLoggedFood[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('nutrition_logs')
    .select('meal_name, kcal, protein_g, carbs_g, fat_g')
    .eq('user_id', user.id)
    .ilike('meal_name', `%${query}%`)
    .order('logged_at', { ascending: false })
    .limit(100);
  const map = new Map<string, MostLoggedFood>();
  for (const row of data ?? []) {
    const key = (row.meal_name ?? '').toLowerCase().trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name: row.meal_name, kcal: row.kcal ?? 0, protein_g: row.protein_g ?? 0, carbs_g: row.carbs_g ?? 0, fat_g: row.fat_g ?? 0, count: 1 });
    } else {
      map.get(key)!.count++;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

// ── useTodayCaloriesBurned ────────────────────────────────────────────────

export function useTodayCaloriesBurned() {
  return useQuery<number>({
    queryKey: ['today-calories-burned'],
    queryFn: async () => {
      const userId = await getUserId();
      const now    = new Date();
      const start  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      const { data } = await supabase
        .from('workouts')
        .select('calories_burned')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .gte('completed_at', start)
        .lte('completed_at', end);
      return (data ?? []).reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
    },
    staleTime: 60_000,
  });
}

// ── useLoggedDates ────────────────────────────────────────────────────────

// ── Meal Templates ────────────────────────────────────────────────────────

export interface TemplateItem {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: TemplateItem[];
  times_used: number;
  notes: string | null;
  created_at: string;
}

export function useMealTemplates() {
  return useQuery<MealTemplate[]>({
    queryKey: ['meal-templates'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('meal_templates')
        .select('*')
        .eq('user_id', userId)
        .order('times_used', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MealTemplate[];
    },
    staleTime: 60_000,
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (template: { name: string; items: TemplateItem[] }) => {
      const userId = await getUserId();
      const totals = template.items.reduce(
        (acc, i) => ({ kcal: acc.kcal + i.kcal, protein_g: acc.protein_g + i.protein_g, carbs_g: acc.carbs_g + i.carbs_g, fat_g: acc.fat_g + i.fat_g }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      );
      const { error } = await supabase.from('meal_templates').insert({
        user_id: userId,
        name:    template.name,
        items:   template.items,
        ...totals,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-templates'] }),
  });
  return { saveTemplate: mutation.mutateAsync, isLoading: mutation.isPending, error: mutation.error };
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-templates'] }),
  });
  return { deleteTemplate: mutation.mutateAsync };
}

export function useLogTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ template, mealType }: { template: MealTemplate; mealType: string }) => {
      const userId = await getUserId();
      const now    = new Date().toISOString();
      const entries = template.items.map(item => ({
        user_id:   userId,
        meal_name: item.name,
        kcal:      item.kcal,
        protein_g: item.protein_g,
        carbs_g:   item.carbs_g,
        fat_g:     item.fat_g,
        meal_type: mealType,
        source:    'manual' as const,
        logged_at: now,
      }));
      const { error } = await supabase.from('nutrition_logs').insert(entries);
      if (error) throw error;
      await supabase.from('meal_templates')
        .update({ times_used: template.times_used + 1 })
        .eq('id', template.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nutrition'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['meal-templates'] });
    },
  });
  return { logTemplate: mutation.mutateAsync, isLoading: mutation.isPending };
}

// ── useLoggedDates ────────────────────────────────────────────────────────

export function useLoggedDates(year: number, month: number) {
  return useQuery<Set<string>>({
    queryKey: ['logged-dates', year, month],
    queryFn: async () => {
      const userId = await getUserId();
      const start  = new Date(year, month, 1).toISOString();
      const end    = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
      const { data } = await supabase
        .from('nutrition_logs')
        .select('logged_at')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lte('logged_at', end);
      const dates = new Set<string>();
      for (const row of data ?? []) {
        const d = new Date(row.logged_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.add(`${y}-${m}-${day}`);
      }
      return dates;
    },
    staleTime: 5 * 60_000,
  });
}
