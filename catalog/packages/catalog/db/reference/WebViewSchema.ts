import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface WebView extends Product {
  productTypeId: 'webView';
  productTypeGroupId: 'apk';
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
    category: string;
    /**
     * @keyField true
     */
    name: string;
    description?: string;
    thumbnail?: string;
    packageName?: string;
    /**
     * @keyField true
     */
    webViewUrl: string;
    displayPriority?: number;
    basePrice?: {
      purchase: number;
    };
    webViewConfig?: WebViewConfig;
  };
}

interface WebViewConfig {
  fileSelectionAllowed?: boolean;
  downloadAllowed?: boolean;
  downloadDirectory?: string;
  killOnPause?: boolean;
  orientationLock?: WebViewOrientation;
  microphoneAllowed?: boolean;
  customUrlDecorations?: string;
}

enum WebViewOrientation {
  Portrait = 'portrait',
  Landscape = 'landscape',
}
