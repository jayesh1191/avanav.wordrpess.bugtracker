import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from '@/store/app';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmProvider } from '@/components/ui/confirm';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import Dashboard from '@/pages/Dashboard';
import Bugs from '@/pages/Bugs';
import BugForm from '@/pages/BugForm';
import BugDetail from '@/pages/BugDetail';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Users from '@/pages/Users';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import { ApiError } from '@/api/client';
import { PageBody } from '@/components/layout/PageHeader';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/** Wait for the vocabularies (statuses, priorities…) before rendering pages that rely on them. */
function Gate() {
  const { settings, settingsError } = useApp();
  if (settingsError) return <div className="p-6"><ErrorState error={settingsError} onRetry={() => window.location.reload()} /></div>;
  if (!settings) return <div className="space-y-3 p-6"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="bugs" element={<Bugs />} />
        <Route path="bugs/new" element={<BugForm />} />
        <Route path="bugs/:id" element={<BugDetail />} />
        <Route path="bugs/:id/edit" element={<BugForm />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<PageBody><ProjectDetail /></PageBody>} />
        <Route path="users" element={<PageBody><Users /></PageBody>} />
        <Route path="reports" element={<PageBody><Reports /></PageBody>} />
        <Route path="notifications" element={<PageBody><Notifications /></PageBody>} />
        <Route path="settings" element={<PageBody><Settings /></PageBody>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ToastProvider>
            <ConfirmProvider>
              <HashRouter><Gate /></HashRouter>
            </ConfirmProvider>
          </ToastProvider>
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
