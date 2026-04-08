import { IntervalUnit, Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface TabletPackage extends Product {
  productTypeId: 'tabletPackage';
  productTypeGroupId: 'tabletPackage';
  childProductIds?: number[]; // apk ids and tablet id
  purchaseCode: 'TABLET';
  purchaseTypes: ['subscription'];
  fulfillmentType: 'physical';
  subscribable?: false;
  /**
   * @keyField true
   */
  isBlocked?: boolean;
  /**
   * @keyField true
   */
  isManuallyBlocked?: boolean;
  meta: {
    /**
     * @requiredIfActive true
     * @keyField true
     */
    type: PackageType; // community, personal, officer, pool, warehouse, inventory
    /**
     * @keyField true
     */
    name: string;
    /**
     * @requiredIfActive true
     */
    description?: string;
    thumbnail?: string;
    /**
     * @keyField true
     */
    demo: boolean;
    isSession?: boolean;
    premiumContent: boolean;
    /**
     * @requiredIfActive true
     */
    basePrice?: {
      /**
       * @autoComplete true
       * @distinctValue meta.basePrice.subscription
       * @keyField true
       */
      subscription: number;
    };
    startDate?: string;
    endDate?: string;

    billingInterval: {
      /**
       * @default 1
       */
      count: number;
      /**
       * @default "months"
       */
      interval: IntervalUnit;
    };
    emmPolicyId?: string;
    emmPolicyName?: string;
  };
  filter: {
    /**
     * @keyField true
     */
    customerId?: string[];
    siteId?: string[];
    /**
     * @keyField true
     */
    channel?: string[];
  };
  webViews?: number[];
}

enum PackageType {
  Personal = 'personal',
  Officer = 'officer',
  Community = 'community',
  Pool = 'pool',
  Warehouse = 'warehouse',
  Inventory = 'inventory',
}
