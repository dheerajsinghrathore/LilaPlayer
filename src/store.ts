import { create } from 'zustand';
import type { HeatmapMode } from './types/game';

interface ViewerState {
  mapId: string;
  matchId: string;
  date: string;
  playerType: 'all' | 'human' | 'bot';
  heatmap: HeatmapMode | 'none';
  currentTimeMs: number;
  playbackSpeed: number;
  playing: boolean;
  set: <K extends keyof Omit<ViewerState, 'set'>>(key: K, value: ViewerState[K]) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  mapId: 'all',
  matchId: 'all',
  date: 'all',
  playerType: 'all',
  heatmap: 'traffic',
  currentTimeMs: 0,
  playbackSpeed: 1,
  playing: false,
  set: (key, value) => set({ [key]: value } as Partial<ViewerState>)
}));
