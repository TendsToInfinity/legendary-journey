export interface RuleSets {
  [type: string]: Rule[];
}

export interface Rule {
  ruleId?: number;
  customerId?: string | null;
  siteId?: string | null;
  productTypeId: string;
  productId?: number | null;
  name: string;
  type: RuleType;
  clauses: any;
  action: any;
  enabled: boolean;
  cdate?: string;
  udate?: string;
  version?: number;
}

export interface ProductTypeAvailabilityRule extends Rule {
  type: RuleType.ProductTypeAvailability;
  // eslint-disable-next-line @typescript-eslint/ban-types
  clauses: {};
  action: { available: boolean };
}

export interface ProductAvailabilityRule extends Rule {
  type: RuleType.ProductAvailability;
  clauses: {
    [key: string]: any[];
  };
  action: {
    available: boolean;
  };
}

export interface ProductCacheRule extends Rule {
  type: RuleType.ProductCache;
  clauses: {
    [key: string]: any[];
  };
  action: {
    cache: boolean;
  };
}

export interface ProductPriceRule extends Rule {
  type: RuleType.ProductPrice;
  clauses: {
    [key: string]: any[];
  };
  action: {
    meta: {
      effectivePrice: {
        [purchaseType: string]: number;
      };
    };
  };
}

export interface ProductSubscriptionAvailabilityRule extends Rule {
  type: RuleType.ProductSubscriptionAvailability;
  // eslint-disable-next-line @typescript-eslint/ban-types
  clauses: {};
  action: { available: boolean };
  productId: number;
}

export interface ProductWebViewRule extends Rule {
  type: RuleType.ProductWebView;
  productId: number;
  clauses: {
    [key: string]: any[];
  };
  action: {
    meta: {
      effectiveUrl: string;
      effectiveDisplayPriority: number;
    };
  };
}

// If you add a new product RuleType, make sure it starts with 'product_'.
// See `ProductDao.findByIdsAndApplyRules()` for why.
export enum RuleType {
  ProductTypeAvailability = 'product_type_availability',
  ProductAvailability = 'product_availability',
  ProductPrice = 'product_price',
  ProductCache = 'product_cache',
  ProductSubscriptionAvailability = 'product_subscription_availability',
  ProductWebView = 'product_web_view',
}

export interface RuleContext {
  customerId: string | null;
  siteId: string | null;
  isGlobal: boolean;
  productId: number | null;
}

/**
 * Represents a group of rules with the same context
 */
export interface RuleSet {
  productTypeId: string;
  rules: Rule[];
  context: RuleContext;
}

/**
 * Represents a set of rules that are identical except for context
 */
export interface SharedRuleSet {
  ruleIds: number[];
  clauses: any;
  enabled: boolean;
  action: any;
  contexts: RuleContext[];

  productTypeId: string;
  productIds?: number[]; // subscription rule set
  customerIds?: string[];
  siteIds?: string[];
}
