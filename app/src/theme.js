export const darkColors = {
  bg: '#0b1220', card: '#111c33', card2: '#1a2745', border: '#24355c',
  primary: '#38bdf8', accent: '#facc15', good: '#22c55e', bad: '#ef4444',
  text: '#f1f5f9', muted: '#94a3b8',
  onPrimary: '#0b1220',   // text/icons drawn on top of primary/accent buttons
  picked: '#0369a1',      // background of the answer you tapped (before the reveal)
};

export const lightColors = {
  bg: '#f1f5f9', card: '#ffffff', card2: '#e8eef7', border: '#d3dcea',
  primary: '#0284c7', accent: '#a16207', good: '#16a34a', bad: '#dc2626',
  text: '#0f172a', muted: '#64748b',
  onPrimary: '#ffffff',
  picked: '#bae6fd',
};

export const SUBJECTS = ['Mixed', 'IT', 'Math', 'General Knowledge'];
export const DIFFICULTIES = ['any', 'easy', 'medium', 'hard'];
export const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦉', '🐧', '🦄', '🐲'];
export const QUESTION_MS = 15000;

export const BADGES = {
  first_battle: { icon: '⚔️', label: 'First Battle', desc: 'Play a multiplayer match' },
  champion: { icon: '🏆', label: 'Champion', desc: 'Win 5 multiplayer matches' },
  week_warrior: { icon: '🔥', label: 'Week Warrior', desc: 'Reach a 7-day streak' },
  score_1000: { icon: '💯', label: '1000 Club', desc: 'Earn 1000 total points' },
  sharpshooter: { icon: '🎯', label: 'Sharpshooter', desc: 'Answer every question in a quiz correctly' },
};
