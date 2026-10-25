import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/UsersPage';
import RolesPage from './pages/admin/RolesPage';
import LocationsPage from './pages/admin/LocationsPage';
import AssetsPage from './pages/admin/AssetsPage';
import RoutingRulesPage from './pages/admin/RoutingRulesPage';
import ReportsPage from './pages/admin/ReportsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import EscalationsPage from './pages/admin/EscalationsPage';
import SubAdminDashboard from './pages/subadmin/SubAdminDashboard';
import LabDashboard from './pages/lab/LabDashboard';
import CreateTicketPage from './pages/shared/CreateTicketPage';
import TicketsPage from './pages/shared/TicketsPage';
import TicketDetailPage from './pages/shared/TicketDetailPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { navByRole } from './config/navigation';
import type { Role } from './domain/types';

/** Nav entries whose screens are not built yet render a placeholder. */
function placeholderRoutes(role: Role, base: string) {
  return navByRole[role]
    .flatMap((g) => g.items)
    .filter((item) => item.placeholder)
    .map((item) => (
      <Route
        key={item.path}
        path={item.path.replace(`${base}/`, '')}
        element={<PlaceholderPage title={item.label} icon={item.icon} />}
      />
    ));
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* Super Admin */}
      <Route path="/admin" element={<AppLayout role="MAIN_ADMIN" />}>
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="unassigned" element={<TicketsPage unassignedOnly />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="new" element={<CreateTicketPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="asset-types" element={<AssetsPage />} />
        <Route path="routing-rules" element={<RoutingRulesPage />} />
        <Route path="escalations" element={<EscalationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-log" element={<AuditLogsPage />} />
        {placeholderRoutes('MAIN_ADMIN', '/admin')}
      </Route>

      {/* Read-only Admin: campus overview and ticket details */}
      <Route path="/viewer-admin" element={<AppLayout role="ADMIN" />}>
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="unassigned" element={<TicketsPage unassignedOnly />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
      </Route>

      {/* Sub-Admin: portal only, assigned tickets only */}
      <Route path="/sub-admin" element={<AppLayout role="SUB_ADMIN" />}>
        <Route index element={<SubAdminDashboard />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        {placeholderRoutes('SUB_ADMIN', '/sub-admin')}
      </Route>

      {/* Lab Assistant (complaint user) */}
      <Route path="/app" element={<AppLayout role="LAB_ASSISTANT" />}>
        <Route index element={<LabDashboard />} />
        <Route path="new" element={<CreateTicketPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        {placeholderRoutes('LAB_ASSISTANT', '/app')}
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
