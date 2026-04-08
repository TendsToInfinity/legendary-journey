import { Inject } from 'typescript-ioc';
import { ParentProductDao } from '../../src/data/ParentProductDao';
import { ProductManager } from '../../src/lib/ProductManager';
import { ModelFactory } from '../utils/ModelFactory';

export class MusicIntegrationTestSuite {
  @Inject
  private static productManager: ProductManager;

  @Inject
  private static parentProductDao: ParentProductDao;

  public static async addTrackChildrenToAlbum(
    productId: number,
    childProductId: number,
  ) {
    await this.parentProductDao.push(
      productId,
      'childProductIds',
      childProductId,
      {},
    );
  }

  public static async createProductFromSchema(
    jsonSchema: any,
    overrides: any = {},
  ) {
    const product = ModelFactory.productFromSchema(jsonSchema, {
      ...overrides,
    });

    const productId = await this.productManager.createProduct(
      ModelFactory.product({
        ...product,
      }),
      { apiKey: 'test' },
    );
    product.productId = productId;
    return product;
  }

  public static async loadAlbumWithTracks(
    albumSchema: any,
    trackSchema: any,
    childCount: number,
    albumOverrides: any = {},
    trackOverrides: any = {},
  ) {
    const childProductIds: number[] = [];
    const product = await this.createProductFromSchema(
      albumSchema,
      albumOverrides,
    );
    product['childProducts'] = [];

    // create as many child products as requested
    for (let i = 0; i < childCount; i++) {
      const childProduct = await this.createProductFromSchema(
        trackSchema,
        trackOverrides,
      );
      childProductIds.push(childProduct.productId);
      product.childProducts.push(childProduct);
    }

    // add childIds to the parent product
    await Promise.all(
      childProductIds.map(
        async (childProductId) =>
          await this.addTrackChildrenToAlbum(product.productId, childProductId),
      ),
    );
    product.childProductIds = childProductIds;
    return product;
  }
}
