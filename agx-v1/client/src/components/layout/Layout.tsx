import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-bg overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
