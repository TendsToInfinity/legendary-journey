import { Inject } from 'typescript-ioc';
import {
  ProductSales,
  ProductSalesSearch,
  ProductTypeIds,
} from '../controllers/models/Product';
import { ProductDao } from '../data/PGCatalog/ProductDao';
import { ProductSalesDao } from '../data/PGCatalog/ProductSalesDao';
import { Order } from '../models/Order';
import { OpenSearchManager } from './OpenSearchManager';
import { AuditContext } from './models/AuditContext';

export class ProductSalesManager {
  @Inject
  private productSalesDao!: ProductSalesDao;

  @Inject
  private openSearchManager!: OpenSearchManager;

  @Inject
  private productDao!: ProductDao;

  public findOne = this.productSalesDao.findOne;

  /**
   * Increments totalSales value in relevant Open Search index
   * @param productId Product identifier
   * @param productTypeId Product type identifier
   * @param artistProductId ArtistId of the product if applicable
   * @param additionalSales Number of sales to add to existing totalSales quantity
   */
  private async incrementTotalSalesInOpenSearch(
    productId: number,
    productTypeId: string,
    artistProductId?: number,
    additionalSales: number = 1,
  ): Promise<boolean> {
    let prodIncrementSuccess =
      await this.openSearchManager.incrementProductTotalSales(
        productId,
        productTypeId,
        additionalSales,
      );
    if (artistProductId) {
      prodIncrementSuccess =
        prodIncrementSuccess &&
        (await this.openSearchManager.incrementProductTotalSales(
          artistProductId,
          ProductTypeIds.Artist,
          additionalSales,
        ));
    }
    return prodIncrementSuccess;
  }

  /**
   * Increments by one the number of completedOrders in Postgres and totalSales in relevant Open Search index
   * @param productSalesId Product sales identifier
   * @param productId Product identifier
   * @param productTypeId Product type identifier
   * @param artistProductId Artist product identifier
   */
  public async incrementCompletedOrders(
    productSalesId: number,
    productId: number,
    productTypeId: string,
    artistProductId: number,
  ) {
    await this.productSalesDao.incrementCompletedOrders(productSalesId);
    await this.incrementTotalSalesInOpenSearch(
      productId,
      productTypeId,
      artistProductId,
    );
  }

  public async createProductSales(
    productSales: ProductSales,
    context: AuditContext,
  ): Promise<number> {
    // Try to find a previous record to avoid an extra call to get artist
    const productSalesExistingRecord = await this.productSalesDao.findOne(
      productSales.productSalesId,
    );

    let artistProductId: number;
    let parentProductId: number;

    if (productSalesExistingRecord) {
      artistProductId = productSalesExistingRecord.artistProductId;
      parentProductId = productSalesExistingRecord.parentProductId;
    } else {
      const product = await this.productDao.findOneOrFail(
        productSales.productId,
      );
      const artistProduct = await this.productDao.findArtist(product);

      artistProductId = artistProduct?.productId;
      parentProductId = product.parentProductId;
    }

    if (artistProductId) {
      productSales.artistProductId = artistProductId;
    }

    if (parentProductId) {
      productSales.parentProductId = parentProductId;
    }

    const prodSales = await this.productSalesDao.createAndRetrieve(
      productSales,
      context,
    );

    await this.incrementTotalSalesInOpenSearch(
      productSales.productId,
      productSales.productTypeId,
      productSales.artistProductId,
      productSales.completedOrders,
    );

    return prodSales.productSalesId;
  }

  public async updateProductSales(
    productSales: ProductSales,
    securityContext: object,
  ): Promise<void> {
    // Find product sales record
    const existingProductSales = await this.productSalesDao.findOne(
      productSales.productSalesId,
    );

    // Update product sales record
    const updatedProductSales = await this.productSalesDao.updateAndRetrieve(
      productSales.productSalesId,
      productSales,
      securityContext,
    );

    const updateCount =
      updatedProductSales.completedOrders -
      existingProductSales.completedOrders;

    // Update sales numbers if different
    if (updateCount !== 0) {
      await this.incrementTotalSalesInOpenSearch(
        productSales.productId,
        productSales.productTypeId,
        productSales.artistProductId,
        updateCount,
      );
    }
  }

  /**
   * Creates the product sales search object from the order
   * * @param order Product order
   */
  public toProductSalesSearch(order: Order): ProductSalesSearch {
    const orderDate = new Date(order.cdate);

    const productSalesSearchRecord: ProductSalesSearch = {
      productId: order.product.productId,
      productTypeGroupId: order.product.productTypeGroupId,
      productTypeId: order.product.productType,
      purchaseType: order.purchaseType,
      customerId: order.customerId,
      year: orderDate.getUTCFullYear(),
      month: orderDate.getUTCMonth() + 1,
      day: orderDate.getUTCDate(),
    };

    return productSalesSearchRecord;
  }
}
