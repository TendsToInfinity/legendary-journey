import { RuleContext } from '../controllers/models/Rule';

/**
 * A Per-Product digested product availability rule set
 * Tracks rules that match the product (ruleIds)
 * Tracks available globally (whitelisted or no rules at global level = true, blacklisted at global level = false)
 * Tracks customer ids with white or blacklist matches for this product
 * Tracks site ids with white or blacklist matches for this product
 * Tracks subscription product ids that contain this product
 */
export interface Digest {
  productId: number;
  ruleIds: number[];
  availableGlobally: boolean;
  whitelist: string[];
  blacklist: string[];
  subscriptionProductIds: number[];
  priceOverrides?: PriceOverride[];
  webViewOverrides?: WebViewOverride[];
  sales: Sales;
  version?: number;
  cdate?: string;
  udate?: string;
}

export interface PriceOverride extends RuleContext {
  purchaseType: string;
  effectivePrice: number;
}

export interface WebViewOverride extends RuleContext {
  effectiveUrl: string;
  effectiveDisplayPriority: number;
  contextSortOrder?: number;
}

/**
 * Total sales counts to facilitate OpenSearch result sorting
 */
export interface Sales {
  totalSales?: number;
}
