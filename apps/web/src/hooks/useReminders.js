import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'titan_reminders_v1';

const DEFAULT_CONFIG = {
  enabled: false,
  water:    { on: true, intervalHours: 2 },
  meals:    { on: true, times: ['08:00', '13:00', '19:00'] },
  workout:  { on: true, time: '07:00' },
  weigh_in: { on: true, time: '07:30' },
};

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// Returns current time as 'HH:MM'
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Returns current date as 'YYYY-MM-DD'
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fireNotification(body) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification('Titan', { body, icon: '/favicon.ico' });
  } catch (e) {
    console.warn('[useReminders] Notification failed:', e);
  }
}

export function useReminders() {
  const [config, setConfig]                   = useState(loadConfig);
  const [notificationPermission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );

  // Refs for tracking last-fired state — persisted only in memory per mount
  const lastWaterNotif  = useRef(null);             // Date | null
  const lastMealDates   = useRef({});               // { 'HH:MM': 'YYYY-MM-DD' }
  const lastWorkoutDate = useRef(null);             // 'YYYY-MM-DD' | null
  const lastWeighDate   = useRef(null);             // 'YYYY-MM-DD' | null

  const updateConfig = useCallback((patch) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Main scheduling interval — ticks every 60 seconds
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    function tick() {
      // Re-read live config from localStorage so interval always has the latest
      const live = loadConfig();

      if (!live.enabled || Notification.permission !== 'granted') return;

      const now    = new Date();
      const hhmm   = nowHHMM();
      const today  = todayStr();

      // --- Water reminder (interval-based) ---
      if (live.water?.on) {
        const intervalMs = (live.water.intervalHours ?? 2) * 60 * 60 * 1000;
        const shouldFire =
          lastWaterNotif.current === null ||
          now - lastWaterNotif.current >= intervalMs;

        if (shouldFire) {
          fireNotification('Time to hydrate! Log your water in Sentinel.');
          lastWaterNotif.current = now;
        }
      }

      // --- Meal reminders (fixed daily times) ---
      if (live.meals?.on) {
        const times = live.meals.times ?? [];
        for (const t of times) {
          if (t === hhmm) {
            const lastDate = lastMealDates.current[t];
            if (lastDate !== today) {
              fireNotification("Meal time! Don't forget to log in Sentinel.");
              lastMealDates.current = { ...lastMealDates.current, [t]: today };
            }
          }
        }
      }

      // --- Workout reminder (daily fixed time) ---
      if (live.workout?.on && live.workout.time === hhmm) {
        if (lastWorkoutDate.current !== today) {
          fireNotification("Time to train. Open Forge and crush today's session.");
          lastWorkoutDate.current = today;
        }
      }

      // --- Weigh-in reminder (daily fixed time) ---
      if (live.weigh_in?.on && live.weigh_in.time === hhmm) {
        if (lastWeighDate.current !== today) {
          fireNotification('Morning weigh-in! Log your weight in Vault.');
          lastWeighDate.current = today;
        }
      }
    }

    // Run immediately on mount then every 60 seconds
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Sync permission state if user changes it externally (best-effort polling)
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const id = setInterval(() => {
      if (Notification.permission !== notificationPermission) {
        setPermission(Notification.permission);
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [notificationPermission]);

  return { config, updateConfig, requestPermission, notificationPermission };
}
