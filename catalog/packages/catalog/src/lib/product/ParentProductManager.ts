import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject } from 'typescript-ioc';
import { Product, ProductTypeIds } from '../../controllers/models/Product';
import { ProductDao } from '../../data/PGCatalog/ProductDao';
import { ParentProductDao } from '../../data/ParentProductDao';
import { ProductTypeManager } from '../ProductTypeManager';
import { AuditContext } from '../models/AuditContext';
import { ProductType } from '../models/ProductType';
import { ProductPublishManager } from './ProductPublishManager';

/**
 * This Manager class handles interactions between parent and child products
 * Many of the methods are partial product updates to allow for multiple concurrent children to be processed
 *      and affect their parents.
 */
export class ParentProductManager {
  @Inject
  private parentProductDao!: ParentProductDao;

  @Inject
  private productDao!: ProductDao;

  @Inject
  private productPublishManager!: ProductPublishManager;

  @Inject
  private productTypeManager!: ProductTypeManager;

  public async getParentProduct(
    product: Product,
    productType?: ProductType,
  ): Promise<Product> {
    if (!productType) {
      productType = await this.productTypeManager.getProductType(
        product.productTypeId,
      );
    }
    const parentProductTypeSchema =
      await this.productTypeManager.getValueFromJsonSchemaByFieldName(
        productType,
        'parentProductTypeId',
      );

    if (
      parentProductTypeSchema.length === 0 ||
      !_.get(product, 'source.vendorParentProductId')
    ) {
      throw Exception.UnprocessableEntity({
        errors:
          `Can not create product for vendorProductId: ${product.source.vendorProductId} ` +
          `and vendor name: ${product.source.vendorName} because parent product type for the productType: ` +
          `${productType.productTypeId} does not yet exist.`,
      });
    }
    return await this.productDao.findOneByVendorProductId(
      product.source.vendorParentProductId,
      product.source.vendorName,
      parentProductTypeSchema[0],
    );
  }

  /**
   * Handles updating a parent product source.availabilityForSubscription based on children
   *   If the child is a Track, availabilityForSubscription needs to be set on the parent
   * @param product
   * @param parent
   * @param context
   */
  public async setParentSubscriptionAvailability(
    product: Product,
    parent: Product,
    context: AuditContext,
  ): Promise<Product> {
    // Tracks control the album subscription flag
    if (product.productTypeId !== ProductTypeIds.Track) {
      return;
    }

    let availableForSubscription: boolean;
    if (product.source.availableForSubscription) {
      // if the track is available for subscription, the parent is
      availableForSubscription = true;
    } else if (!!parent.childProductIds && parent.childProductIds.length > 0) {
      // if the track isn't available for subscription, set parent to true only if any child is available for subscription
      const children = await this.parentProductDao.find({
        ids: parent.childProductIds,
      });
      availableForSubscription = !_.isEmpty(
        _.filter(children, { source: { availableForSubscription: true } }),
      );
    } else {
      // if the track isn't available for subscription and there are no children, it is not available for subscription
      availableForSubscription = false;
    }

    if (parent.source.availableForSubscription !== availableForSubscription) {
      // Only update the parent if we effected a change
      parent = await this.parentProductDao.updateAvailableForSubscription(
        parent.productId,
        availableForSubscription,
        context,
      );
    }
    return parent;
  }

  /**
   * Adds a childProductId to a product's childProductIds array directly without affeting the rest of the row
   * Avoids version safety to allow multiple updates to happen rapidly
   * @param childProductId
   * @param parentProductId
   * @param context
   */
  public async addChildToParent(
    childProductId: number,
    parentProductId: number,
    context,
  ): Promise<void> {
    // Add the child.productId to the parent childProductIds array directly
    await this.parentProductDao.push(
      parentProductId,
      'childProductIds',
      childProductId,
      context,
    );
  }
}
