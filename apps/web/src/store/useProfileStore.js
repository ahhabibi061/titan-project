import { create } from 'zustand';

export const useProfileStore = create((set) => ({
  profile: null,
  setProfile:    (profile) => set({ profile }),
  updateProfile: (partial) => set((state) => ({
    profile: state.profile ? { ...state.profile, ...partial } : partial,
  })),
}));
