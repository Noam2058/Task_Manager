export type Status = 'todo' | 'in_progress' | 'bugfix' | 'stuck' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type PlanPeriod = 'none' | 'day' | 'week' | 'month';

export interface Workspace {
  id: string; name: string; color: string; icon: string | null; position: number;
}

export interface Topic {
  id: string; workspace_id: string; name: string; color: string; icon: string | null;
  position: number; is_archived: boolean; created_at: string;
}

export interface TaskGroup {
  id: string; topic_id: string; name: string; color: string; position: number; is_collapsed: boolean;
}

export interface Label { id: string; name: string; color: string }

export interface ChecklistItem { id: string; task_id: string; text: string; is_done: boolean; position: number }

export interface TimeEntry { id: string; task_id: string; started_at: string; ended_at: string | null }

export interface TaskRow {
  id: string; workspace_id: string | null; topic_id: string | null; group_id: string | null;
  parent_id: string | null; title: string; description: string; status: Status; priority: Priority;
  due_date: string | null; due_time: string | null; start_date: string | null;
  plan_period: PlanPeriod; plan_anchor: string | null; estimate_minutes: number | null;
  recurrence_rule: string | null; recurrence_parent_id: string | null; sprint_id: string | null;
  goal_id: string | null; color: string | null; remind_before_min: number; reminded_key?: string | null; position: number;
  completed_at: string | null; is_archived: boolean; created_at: string; updated_at: string;
}

/** משימה מועשרת — כמו שהשרת הישן החזיר */
export interface Task extends TaskRow {
  labels: string[];
  checklist: ChecklistItem[];
  checklist_total: number;
  checklist_done: number;
  tracked_minutes: number;
  timer_started_at: string | null;
  depends_on: string[];
  subtask_ids: string[];
  doc_count: number;
}

export interface Sprint {
  id: string; workspace_id: string | null; name: string; color: string; start_date: string | null;
  end_date: string | null; topic_id: string | null; goal_id: string | null; position: number; created_at: string;
}

export interface Goal {
  id: string; workspace_id: string | null; title: string; description: string; period: 'quarter' | 'year';
  target_date: string | null; color: string; position: number; created_at: string;
}

export interface Habit {
  id: string; name: string; color: string; icon: string | null; frequency: 'daily' | 'weekly';
  target_per_week: number; position: number; is_archived: boolean; created_at: string;
}

export interface HabitLog { habit_id: string; date: string }

export interface DocumentRow {
  id: string; topic_id: string | null; task_id: string | null; filename: string; storage_path: string;
  mime_type: string; size: number; uploaded_at: string;
}

export interface SavedView { id: string; name: string; page: string; filters: Filters; created_at: string }

export interface Template { id: string; name: string; items: Array<string | { title: string }> }

export interface Dependency { task_id: string; depends_on_id: string }

export interface Note {
  id: string; topic_id: string; title: string; content_md: string; position: number; updated_at: string;
}

export interface Automation {
  id: string; topic_id: string; name: string; is_enabled: boolean; created_at: string;
  trigger: { type: 'status_changed' | 'task_created' | 'due_date' | 'checklist_done'; to?: Status; group_id?: string | null };
  action: {
    type: 'move_group' | 'set_status' | 'set_priority' | 'add_label' | 'set_sprint' | 'apply_template';
    group_id?: string; status?: Status; priority?: Priority; label_id?: string; sprint_id?: string; template_id?: string;
  };
}

export interface Settings {
  shabbat_city?: string; shabbat_lat?: number; shabbat_lon?: number; shabbat_candle_minutes?: number;
  daily_summary_hour?: number; workday_minutes?: number; morning_push_hour?: number;
  last_plan_date?: string; last_summary_date?: string;
}

export interface Profile { user_id: string; display_name: string; settings: Settings }

export interface AppState {
  workspaces: Workspace[];
  topics: Topic[];
  groups: TaskGroup[];
  tasks: Task[];
  labels: Label[];
  sprints: Sprint[];
  goals: Goal[];
  habits: Habit[];
  habitLogs: HabitLog[];
  documents: DocumentRow[];
  views: SavedView[];
  templates: Template[];
  profile: Profile | null;
}

export interface Filters {
  statuses?: Status[];
  priorities?: Priority[];
  due?: Array<'overdue' | 'today' | 'week' | 'none'>;
  labels?: string[];
  topics?: string[];
  sprints?: string[];
  showDone?: boolean;
  q?: string;
  sort?: SortKey;
}

export type SortKey = 'manual' | 'due' | 'priority' | 'title' | 'created';
