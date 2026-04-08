export interface ProductType {
  version: number;
  productTypeId: string;
  productTypeGroupId: string;
  subscribable: boolean;
  purchaseCode: string | null;
  purchaseTypes: string[] | null;
  fulfillmentType: string | null;
  jsonSchema: any; // really should be Schema or SpLite, but need recursion support in JSP library
  available: boolean;
  meta?: ProductTypeMeta;
  cdate: string;
  udate: string;
}

export interface ProductTypeMeta {
  /**
   * Are the products default available
   * @default false
   */
  globalAvailability: boolean;
  /**
   * Do orders for this productType have telemetry logs
   * @default false
   */
  telemetry: boolean;
  /**
   * Display friendly name for productType (e.g. "TV Episode")
   */
  displayName: string;
  /**
   * Are the products ingested automatically
   * @default false
   */
  autoIngest: boolean;
  /**
   * if restrictedAccess equals to true edit action requires VP approval
   * @default false
   */
  restrictedAccess?: boolean;
}
