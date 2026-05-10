export interface OutstandingLoansPagedRequest { 
    storeId?: string | null;
    keyword?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    pageIndex?: number;
    pageSize?: number;
}
