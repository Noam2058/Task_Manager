import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useSession, useSync } from './lib/session';
import { useRawState } from './lib/state';
import { useUI } from './store/useUIStore';
import { AppShell } from './components/layout/AppShell';
import { TooltipProvider } from './components/ui/menu';
import { ConfirmDialogHost } from './components/ui/confirm';
import { TaskDrawer } from './components/tasks/TaskDrawer';
import { QuickAddDialog } from './components/tasks/QuickAdd';
import { CommandPalette } from './components/global/CommandPalette';
import { ShortcutsDialog, useGlobalShortcuts } from './components/global/Shortcuts';
import { FocusMode } from './components/global/FocusMode';
import { DayPlanDialog, useDayPlanAuto } from './components/global/DayPlan';
import { useReminders } from './components/global/reminders';
import { ErrorBoundary } from './components/global/ErrorBoundary';
import { SkeletonRows } from './components/ui/misc';
import { today } from './lib/dates';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Today = lazy(() => import('./pages/Today'));
const Week = lazy(() => import('./pages/Week'));
const Month = lazy(() => import('./pages/Month'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Inbox = lazy(() => import('./pages/Inbox'));
const TopicView = lazy(() => import('./pages/TopicView'));
const Sprints = lazy(() => import('./pages/Sprints'));
const SprintView = lazy(() => import('./pages/SprintView'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const Goals = lazy(() => import('./pages/Goals'));
const Habits = lazy(() => import('./pages/Habits'));
const Review = lazy(() => import('./pages/Review'));
const Search = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));

function useThemeSync() {
  const mode = useUI((s) => s.darkMode);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F1118' : '#F4F5F9');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);
}

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg">
      <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded text-white" style={{ background: 'linear-gradient(160deg,#7377F7,#4B4FE0)' }}><ListChecks className="h-6 w-6" /></div>
    </div>
  );
}

/** ?new=1 (קיצור דרך מהמסך הבית) ו-?task=ID (מהתראה) */
function UrlActions() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => {
    const ui = useUI.getState();
    if (params.get('new')) { ui.openQuickAdd({ due_date: today() }); params.delete('new'); setParams(params, { replace: true }); }
    const task = params.get('task');
    if (task) { ui.openTask(task); params.delete('task'); setParams(params, { replace: true }); }
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'open-url' && typeof e.data.url === 'string') navigate(e.data.url); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [params, setParams, navigate]);
  return null;
}

function AuthedApp() {
  useSync(true);
  const q = useRawState();
  useGlobalShortcuts();
  useReminders();
  useDayPlanAuto();
  if (q.isLoading && !q.data) return <Splash />;
  return (
    <>
      <UrlActions />
      <AppShell>
        <ErrorBoundary>
          <Suspense fallback={<SkeletonRows />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/today" element={<Today />} />
              <Route path="/week" element={<Week />} />
              <Route path="/month" element={<Month />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/topics/:id" element={<TopicView />} />
              <Route path="/sprints" element={<Sprints />} />
              <Route path="/sprints/:id" element={<SprintView />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/habits" element={<Habits />} />
              <Route path="/review" element={<Review />} />
              <Route path="/search" element={<Search />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
      <TaskDrawer />
      <QuickAddDialog />
      <CommandPalette />
      <ShortcutsDialog />
      <FocusMode />
      <DayPlanDialog />
    </>
  );
}

export default function App() {
  useThemeSync();
  const session = useSession();
  return (
    <TooltipProvider delayDuration={300}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {session === undefined ? <Splash /> : session ? <AuthedApp /> : <Login />}
      </BrowserRouter>
      <ConfirmDialogHost />
    </TooltipProvider>
  );
}
