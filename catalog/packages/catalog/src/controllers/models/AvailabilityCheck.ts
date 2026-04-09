export interface Availability {
  productId: number;
  available: boolean;
  checks: AvailabilityCheck[];
}

export interface AvailabilityCheck {
  name: AvailabilityCheckName;
  result: boolean;
  detail: string;
}

export enum AvailabilityCheckName {
  ActiveStatus = 'activeStatus',
  ActiveDateRange = 'activeDateRange',
  ProductTypeAvailabilityRule = 'productTypeAvailabilityRule',
  ProductAvailabilityRule = 'productAvailabilityRule',
}

export interface AvailabilityUpdatedClauses {
  blacklistClausesWhereBlock: string;
  whitelistClausesWhereBlock: string;
  whitelistSubscriptionClausesWhereBlock: string;
  blacklistSubscriptionClausesWhereBlock: string;
}
