import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider, ThemeProvider, SidebarProvider } from '@/context';
import { AppShell } from '@/components/layout';
import { ToastContainer } from '@/components/common';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  HomePage,
  TasksPage,
  TaskDetailsPage,
  OpportunitiesPage,
  TicketsPage,
  SettingsPage,
  NotFoundPage,
} from '@/pages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SidebarProvider>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<AppShell />}>
                    <Route index element={<HomePage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="tasks/:taskId" element={<TaskDetailsPage />} />
                    <Route path="opportunities" element={<OpportunitiesPage />} />
                    <Route path="tickets" element={<TicketsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </BrowserRouter>
              <ToastContainer />
            </ToastProvider>
          </SidebarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
