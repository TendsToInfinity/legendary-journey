import { expect } from 'chai';
import { Container } from 'typescript-ioc';
import { CatalogService } from '../../../src/CatalogService';
import {
  ProductSales,
  ProductSalesSearch,
  ProductStatus,
} from '../../../src/controllers/models/Product';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductSalesDao } from '../../../src/data/PGCatalog/ProductSalesDao';
import { ProductManager } from '../../../src/lib/ProductManager';
import { ProductSalesManager } from '../../../src/lib/ProductSalesManager';
import { OrderState } from '../../../src/models/Order';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductSalesDao - Integration', () => {
  let productDao: ProductDao;
  let productManager: ProductManager;
  let productSalesManager: ProductSalesManager;
  let productSalesDao: ProductSalesDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    productDao = Container.get(ProductDao);
    productManager = Container.get(ProductManager);
    productSalesManager = Container.get(ProductSalesManager);
    productSalesDao = Container.get(ProductSalesDao);
  });

  describe('increment', async () => {
    it('creates a productSales record and automatically increments completedOrders', async () => {
      const product = ModelFactory.product({
        source: {
          productTypeId: 'movie',
          url: 'www.test.local',
        },
        status: ProductStatus.Inactive,
      });

      product.productId = await productManager.createProduct(product, {
        apiKey: 'test',
      });

      const order = ModelFactory.order({
        product: product,
        state: OrderState.Complete,
      });

      const productSalesSearchCriteria: ProductSalesSearch =
        productSalesManager.toProductSalesSearch(order);
      const productSales = {
        ...productSalesSearchCriteria,
        completedOrders: 1,
      } as ProductSales;

      productSales.productSalesId = (
        await productSalesDao.createAndRetrieve(productSales, {
          apiKey: 'test',
        })
      ).productSalesId;

      await productSalesDao.incrementCompletedOrders(
        productSales.productSalesId,
      );

      const response = await productSalesDao.findOne(
        productSales.productSalesId,
      );

      expect(response.completedOrders).to.equal(2);
      expect(response.month).to.be.within(1, 12);
    });
  });
});
