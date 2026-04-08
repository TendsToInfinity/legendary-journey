import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Apk extends Product {
  productTypeId: 'apk';
  productTypeGroupId: 'apk';
  purchaseTypes: ['purchase'];
  purchaseCode: 'APK';
  fulfillmentType: 'digital';
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
     * @autoComplete true
     * @distinctValue meta.category
     * @keyField true
     * @pattern ^[a-z]+$
     */
    category: string; // lowercase letters only
    /**
     * @keyField true
     */
    name: string;
    /**
     * @keyField true
     */
    compatibility: string[];
    description?: string;
    thumbnail?: string;
    startDate?: string;
    endDate?: string;
    cameraRequired: boolean;
    /**
     * @keyField true
     */
    androidClass: string; // "net.securustech.sv.myaccount",
    appManagementAllowed: boolean;
    privilegedApp: boolean;
    systemApp: boolean;
    basePrice?: {
      purchase: number;
    };
  };
  postInstallCommand?: string;
}
