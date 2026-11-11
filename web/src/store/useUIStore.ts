import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Filters } from '@/types';

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'timeline';

interface QuickAddDefaults { topic_id?: string; group_id?: string; sprint_id?: string; due_date?: string; start_date?: string; parent_id?: string; goal_id?: string }

interface UIState {
  darkMode: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  activeWorkspace: string; // 'all' או id
  viewModeByTopic: Record<string, ViewMode>;
  collapsedGroups: Record<string, boolean>;
  expandedTasks: Record<string, boolean>;
  filtersByPage: Record<string, Filters>;
  // זמני
  openTaskId: string | null;
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  quickAddOpen: boolean;
  quickAddDefaults: QuickAddDefaults;
  selectedTaskIds: string[];
  focusTaskId: string | null | undefined; // undefined = סגור, null = פתוח בלי משימה
  dayPlanOpen: 'plan' | 'summary' | null;

  set: (p: Partial<UIState>) => void;
  setDark: (m: UIState['darkMode']) => void;
  toggleSidebar: () => void;
  setViewMode: (topicId: string, m: ViewMode) => void;
  toggleGroup: (id: string) => void;
  toggleExpanded: (id: string) => void;
  setFilters: (page: string, f: Filters) => void;
  openTask: (id: string | null) => void;
  openQuickAdd: (d?: QuickAddDefaults) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      darkMode: 'system',
      sidebarCollapsed: false,
      activeWorkspace: 'all',
      viewModeByTopic: {},
      collapsedGroups: {},
      expandedTasks: {},
      filtersByPage: {},
      openTaskId: null,
      mobileNavOpen: false,
      paletteOpen: false,
      shortcutsOpen: false,
      quickAddOpen: false,
      quickAddDefaults: {},
      selectedTaskIds: [],
      focusTaskId: undefined,
      dayPlanOpen: null,

      set: (p) => set(p),
      setDark: (m) => set({ darkMode: m }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setViewMode: (topicId, m) => set((s) => ({ viewModeByTopic: { ...s.viewModeByTopic, [topicId]: m } })),
      toggleGroup: (id) => set((s) => ({ collapsedGroups: { ...s.collapsedGroups, [id]: !s.collapsedGroups[id] } })),
      toggleExpanded: (id) => set((s) => ({ expandedTasks: { ...s.expandedTasks, [id]: !s.expandedTasks[id] } })),
      setFilters: (page, f) => set((s) => ({ filtersByPage: { ...s.filtersByPage, [page]: f } })),
      openTask: (id) => set({ openTaskId: id }),
      openQuickAdd: (d = {}) => set({ quickAddOpen: true, quickAddDefaults: d }),
      toggleSelected: (id) => set((s) => ({
        selectedTaskIds: s.selectedTaskIds.includes(id) ? s.selectedTaskIds.filter((x) => x !== id) : [...s.selectedTaskIds, id],
      })),
      clearSelection: () => set({ selectedTaskIds: [] }),
    }),
    {
      name: 'task-manager-ui',
      partialize: (s) => ({
        darkMode: s.darkMode, sidebarCollapsed: s.sidebarCollapsed, activeWorkspace: s.activeWorkspace,
        viewModeByTopic: s.viewModeByTopic, collapsedGroups: s.collapsedGroups, expandedTasks: s.expandedTasks,
        filtersByPage: s.filtersByPage,
      }),
    },
  ),
);
