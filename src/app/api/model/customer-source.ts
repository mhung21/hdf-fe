export interface CustomerSource {
  sourceId: string;
  sourceName: string;
  isActive: boolean;
  sortOrder: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
