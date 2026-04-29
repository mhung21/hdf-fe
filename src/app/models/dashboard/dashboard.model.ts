// Dashboard Statistics Models
export interface DashboardStats {
  totalLoans: number;
  totalLoansTrend: number; // percentage
  activeLoanAmount: number;
  activeLoanAmountTrend: number;
  collectionsToday: number;
  collectionsTodayTrend: number;
  overdueLoans: number;
  overdueLoansTrend: number;
}

export interface LoanStatusDistribution {
  label: string;
  value: number;
  color: string;
}

export interface MonthlyCollection {
  month: string;
  collected: number;
  target: number;
}

export interface OverdueLoan {
  contractNo: string;
  customerName: string;
  dueDate: Date;
  daysOverdue: number;
  amount: number;
  riskLevel: 'WARNING' | 'LATE' | 'POTENTIAL_BAD_DEBT';
}

export interface StorePerformance {
  storeName: string;
  loanCount: number;
  collectionRate: number;
  overdueRate: number;
}

// Menu Navigation Interface
export interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  badge?: string | number;
  children?: ChildMenuItem[];
  roles?: string[]; // Quyền truy cập: ADMIN, STORE_MANAGER, STAFF
}

export interface ChildMenuItem {
  label: string;
  route: string;
  badge?: string | number;
  roles?: string[]; // Quyền truy cập: ADMIN, STORE_MANAGER, STAFF
}
