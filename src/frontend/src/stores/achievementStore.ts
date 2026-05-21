import { create } from 'zustand';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-policy',
    title: 'Policy Pioneer',
    description: 'Created your first governance policy',
    icon: 'shield',
  },
  {
    id: 'first-denial',
    title: 'Guardrail Active',
    description: 'Your policies denied an unauthorized action',
    icon: 'shield-alert',
  },
  {
    id: 'hundred-decisions',
    title: 'Centurion',
    description: '100 governed decisions processed',
    icon: 'award',
  },
  {
    id: 'zero-violations-week',
    title: 'Clean Slate',
    description: 'Zero policy violations for a full week',
    icon: 'check-circle',
  },
  {
    id: 'five-agents',
    title: 'Fleet Commander',
    description: 'Connected 5 governed agents',
    icon: 'users',
  },
  {
    id: 'playground-test',
    title: 'Safety First',
    description: 'Tested a policy in the governance playground',
    icon: 'play-circle',
  },
];

interface AchievementState {
  unlocked: Record<string, string>;
  pending: Achievement | null;
  allAchievements: Achievement[];
  unlock: (id: string) => void;
  dismissPending: () => void;
  isUnlocked: (id: string) => boolean;
  getProgress: () => { unlocked: number; total: number };
}

const persistKey = 'cognivern-achievements';

const getStored = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(persistKey) || '{}');
  } catch {
    return {};
  }
};

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlocked: getStored(),
  pending: null,
  allAchievements: ACHIEVEMENTS,

  unlock: (id: string) => {
    const { unlocked } = get();
    if (unlocked[id]) return;

    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return;

    const newUnlocked = { ...unlocked, [id]: new Date().toISOString() };
    localStorage.setItem(persistKey, JSON.stringify(newUnlocked));
    set({
      unlocked: newUnlocked,
      pending: { ...achievement, unlockedAt: newUnlocked[id] },
    });
  },

  dismissPending: () => set({ pending: null }),

  isUnlocked: (id: string) => !!get().unlocked[id],

  getProgress: () => ({
    unlocked: Object.keys(get().unlocked).length,
    total: ACHIEVEMENTS.length,
  }),
}));
