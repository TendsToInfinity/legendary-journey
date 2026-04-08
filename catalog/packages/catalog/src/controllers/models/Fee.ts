export interface Fee {
  feeId?: number;
  customerId?: string | null;
  siteId?: string | null;
  productTypeId: string;
  name: string;
  amount: number;
  percent: boolean;
  clauses: any;
  enabled: boolean;
  version?: number;
  cdate?: string;
  udate?: string;
}
