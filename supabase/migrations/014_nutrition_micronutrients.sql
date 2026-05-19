-- Add micronutrient columns to nutrition_logs
alter table nutrition_logs add column if not exists sodium_mg numeric(8,2);
alter table nutrition_logs add column if not exists potassium_mg numeric(8,2);
alter table nutrition_logs add column if not exists calcium_mg numeric(8,2);
alter table nutrition_logs add column if not exists iron_mg numeric(6,2);
alter table nutrition_logs add column if not exists vitamin_c_mg numeric(6,2);
alter table nutrition_logs add column if not exists vitamin_d_iu numeric(6,2);
alter table nutrition_logs add column if not exists magnesium_mg numeric(6,2);
alter table nutrition_logs add column if not exists zinc_mg numeric(5,2);
alter table nutrition_logs add column if not exists saturated_fat_g numeric(6,2);
alter table nutrition_logs add column if not exists sugar_g numeric(6,2);
alter table nutrition_logs add column if not exists cholesterol_mg numeric(6,2);
