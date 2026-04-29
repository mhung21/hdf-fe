export enum LoanContractStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_DISBURSEMENT = 'PENDING_DISBURSEMENT',
  DISBURSED = 'DISBURSED',
  BAD_DEBT = 'BAD_DEBT',
  SETTLED = 'SETTLED',
  CLOSED = 'CLOSED',
  BAD_DEBT_CLOSED = 'BAD_DEBT_CLOSED',
  CANCELLED = 'CANCELLED',
}

export const LOAN_CONTRACT_STATUS_LABELS: Record<LoanContractStatus, string> = {
  [LoanContractStatus.DRAFT]: 'Nháp',
  [LoanContractStatus.PENDING_APPROVAL]: 'Chờ duyệt',
  [LoanContractStatus.PENDING_DISBURSEMENT]: 'Chờ giải ngân',
  [LoanContractStatus.DISBURSED]: 'Đang thu',
  [LoanContractStatus.BAD_DEBT]: 'Nợ xấu',
  [LoanContractStatus.SETTLED]: 'Đã tất toán',
  [LoanContractStatus.CLOSED]: 'Đã đóng',
  [LoanContractStatus.BAD_DEBT_CLOSED]: 'Đã đóng (nợ xấu)',
  [LoanContractStatus.CANCELLED]: 'Đã hủy',
};

export const LOAN_CONTRACT_STATUS_CLASSES: Record<LoanContractStatus, string> = {
  [LoanContractStatus.DRAFT]: 'bg-gray-100 text-gray-600 border border-gray-200',
  [LoanContractStatus.PENDING_APPROVAL]: 'bg-purple-50 text-purple-700 border border-purple-200',
  [LoanContractStatus.PENDING_DISBURSEMENT]: 'bg-amber-50 text-amber-700 border border-amber-200',
  [LoanContractStatus.DISBURSED]: 'bg-blue-50 text-blue-700 border border-blue-200',
  [LoanContractStatus.BAD_DEBT]: 'bg-red-50 text-red-700 border border-red-200',
  [LoanContractStatus.SETTLED]: 'bg-green-50 text-green-700 border border-green-200',
  [LoanContractStatus.CLOSED]: 'bg-gray-100 text-gray-600 border border-gray-200',
  [LoanContractStatus.BAD_DEBT_CLOSED]: 'bg-red-50 text-red-800 border border-red-300',
  [LoanContractStatus.CANCELLED]: 'bg-gray-100 text-gray-400 border border-gray-200',
};

/** Các status được coi là "đang hoạt động" (chưa kết thúc) */
export const ACTIVE_LOAN_STATUSES: LoanContractStatus[] = [
  LoanContractStatus.DRAFT,
  LoanContractStatus.PENDING_APPROVAL,
  LoanContractStatus.PENDING_DISBURSEMENT,
  LoanContractStatus.DISBURSED,
  LoanContractStatus.BAD_DEBT,
];
