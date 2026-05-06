import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './guards/auth.guard';
import { RoleCode } from './models/role.model';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const routes: Routes = [
  // Default route - redirect to dashboard
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // Public routes (guests only)
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },

  // Protected routes with main layout (authenticated users only)
  {
    path: '',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
        providers: [provideCharts(withDefaultRegisterables())]
      },
      {
        path: 'change-password',
        loadComponent: () => import('./pages/auth/change-password.component').then(m => m.ChangePasswordComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.component').then(m => m.UsersComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'collaborators',
        loadComponent: () => import('./pages/collaborators/collaborators.component').then(m => m.CollaboratorsComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'users/roles',
        loadComponent: () => import('./pages/users/role-permissions-tab.component').then(m => m.RolePermissionsTabComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'stores',
        loadComponent: () => import('./pages/stores/stores.component').then(m => m.StoresComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'customers',
        loadComponent: () => import('./pages/customers/customers.component').then(m => m.CustomersComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER, RoleCode.STAFF])]
      },
      {
        path: 'loans',
        loadComponent: () => import('./pages/loans/loans.component').then(m => m.LoansComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER, RoleCode.STAFF])]
      },
      {
        path: 'vouchers',
        loadComponent: () => import('./pages/vouchers/vouchers.component').then(m => m.VouchersComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER, RoleCode.STAFF])]
      },
      {
        path: 'bad-debts',
        loadComponent: () => import('./pages/bad-debts/bad-debts.component').then(m => m.BadDebtsComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER, RoleCode.STAFF])]
      },
      {
        path: 'reports/store',
        loadComponent: () => import('./pages/reports/reports-store.component').then(m => m.ReportsStoreComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'reports/all',
        loadComponent: () => import('./pages/reports/reports-all.component').then(m => m.ReportsAllComponent),
        canActivate: [roleGuard([RoleCode.ADMIN])]
      },
      {
        path: 'reports/financial',
        loadComponent: () => import('./pages/reports/financial/reports-financial.component').then(m => m.ReportsFinancialComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'reports/commission',
        loadComponent: () => import('./pages/reports/commission/reports-commission.component').then(m => m.ReportsCommissionComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'reports/risk',
        loadComponent: () => import('./pages/reports/risk/reports-risk.component').then(m => m.ReportsRiskComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER, RoleCode.STAFF])]
      },
      {
        path: 'reports/customers',
        loadComponent: () => import('./pages/reports/customers/reports-customers.component').then(m => m.ReportsCustomersComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER, RoleCode.STAFF])]
      },
      {
        path: 'reports/employees',
        loadComponent: () => import('./pages/reports/employees/reports-employees.component').then(m => m.ReportsEmployeesComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'reports/collaterals',
        loadComponent: () => import('./pages/reports/collaterals/reports-collaterals.component').then(m => m.ReportsCollateralsComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'loan-products',
        loadComponent: () => import('./pages/loan-products/loan-products.component').then(m => m.LoanProductsComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'customer-sources',
        loadComponent: () => import('./pages/customer-sources/customer-sources.component').then(m => m.CustomerSourcesComponent),
        canActivate: [roleGuard([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])]
      },
      {
        path: 'policies',
        loadComponent: () => import('./pages/policies/policies.component').then(m => m.PoliciesComponent),
        canActivate: [roleGuard([RoleCode.ADMIN])]
      },
      {
        path: 'day-locks',
        loadComponent: () => import('./pages/day-locks/day-locks.component').then(m => m.DayLocksComponent),
        canActivate: [roleGuard([RoleCode.ADMIN])]
      },
    ]
  },

  // Wildcard - 404 Not Found
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
