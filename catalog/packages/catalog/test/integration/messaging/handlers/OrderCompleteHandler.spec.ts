import { CorpJwt } from '@securustablets/libraries.httpsecurity';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { CatalogService } from '../../../../src/CatalogService';
import {
  ProductSales,
  ProductSalesSearch,
  ProductStatus,
} from '../../../../src/controllers/models/Product';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { ProductManager } from '../../../../src/lib/ProductManager';
import { ProductSalesManager } from '../../../../src/lib/ProductSalesManager';
import { app } from '../../../../src/main';
import { MessagingConstants } from '../../../../src/messaging/MessagingConstants';
import { OrderCompleteHandler } from '../../../../src/messaging/handlers/OrderCompleteHandler';
import { OrderState } from '../../../../src/models/Order';
import { ModelFactory } from '../../../utils/ModelFactory';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';

describe('OrderCompleteHandler - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let orderCompleteHandler: OrderCompleteHandler;
  let productManager: ProductManager;
  let productSalesManager: ProductSalesManager;
  let productTypeDao: ProductTypeDao;
  let corpJwt: CorpJwt;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(async () => {
    await request(app)
      .get(`/test/cache/clear`)
      .set('X-API-KEY', `API_KEY_DEV`)
      .expect(204);

    orderCompleteHandler = Container.get(OrderCompleteHandler);
    productManager = Container.get(ProductManager);
    productSalesManager = Container.get(ProductSalesManager);
    productTypeDao = Container.get(ProductTypeDao);
    corpJwt = SecurityFactory.corpJwt();
  });

  describe('handleMessage', () => {
    it('should create product sales record and increment completed orders count', async () => {
      const routingKey = MessagingConstants.ORDER_COMPLETE_PURCHASE_ROUTING_KEY;
      const product = ModelFactory.product({
        source: {
          productTypeId: 'movie',
          url: 'www.test.local',
        },
        status: ProductStatus.Inactive,
      });
      product.productId = await productManager.createProduct(product, {
        corpJwt,
      });

      const order = ModelFactory.order({
        product: product,
        state: OrderState.Complete,
      });

      const orderDate = new Date(order.cdate);

      await orderCompleteHandler.handleMessage(routingKey, order);

      await Bluebird.delay(500);

      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .expect(204);

      const productSales = await productSalesManager.findOne({
        by: {
          productId: order.product.productId,
        },
      });

      expect(productSales.month).to.be.within(1, 12);
      expect(productSales.completedOrders).to.equal(1);
      expect(productSales.day).to.equal(orderDate.getUTCDate());
      expect(productSales.customerId).to.equal(order.customerId);
      expect(productSales.productName).to.equal(order.product.name);
      expect(productSales.purchaseType).to.equal(order.purchaseType);
      expect(productSales.year).to.equal(orderDate.getUTCFullYear());
      expect(productSales.month).to.equal(orderDate.getUTCMonth() + 1);
      expect(productSales.productId).to.equal(order.product.productId);
      expect(productSales.productTypeId).to.equal(order.product.productType);
      expect(productSales.productTypeGroupId).to.equal(
        order.product.productTypeGroupId,
      );
    });

    it('given existing product sales record, should increment completed orders', async () => {
      const routingKey = MessagingConstants.ORDER_COMPLETE_PURCHASE_ROUTING_KEY;
      const product = ModelFactory.product({
        source: {
          productTypeId: 'movie',
          url: 'www.test.local',
        },
        status: ProductStatus.Inactive,
      });
      product.productId = await productManager.createProduct(product, {
        corpJwt,
      });

      const order = ModelFactory.order({
        product: {
          ...product,
          productType: product.productTypeId,
        },
        state: OrderState.Complete,
      });

      const productSalesSearchCriteria: ProductSalesSearch =
        productSalesManager.toProductSalesSearch(order);
      const productSales = {
        ...productSalesSearchCriteria,
        completedOrders: 1,
      } as ProductSales;
      productSales.productSalesId =
        await productSalesManager.createProductSales(productSales, {
          routingKey,
        });

      await Bluebird.delay(500);

      const retrievedProductSales = await productSalesManager.findOne({
        by: productSalesSearchCriteria,
      });

      expect(retrievedProductSales.completedOrders).to.equal(1);
      expect(retrievedProductSales.month).to.be.within(1, 12);

      await orderCompleteHandler.handleMessage(routingKey, order);

      await Bluebird.delay(1000);

      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .expect(204);

      const twoProductSales = await productSalesManager.findOne({
        by: productSalesSearchCriteria,
      });

      expect(twoProductSales.completedOrders).to.equal(2);

      await Bluebird.delay(1000);

      const { body: searchResult } = await request(app)
        .post('/products/search')
        .set('X-API-KEY', `API_KEY_DEV`)
        .send({
          query: {
            productTypeId: product.productTypeId,
            clauses: {},
            productId: product.productId.toString(),
          },
          context: {
            enforce: false,
          },
          pageNumber: 0,
          pageSize: 10,
          total: false,
        })
        .expect(200);

      expect(searchResult.data[0].digest.sales.totalSales).to.equal(2);

      const anotherProduct = ModelFactory.product({
        source: {
          productTypeId: 'movie',
          url: 'www.test.local',
        },
        status: ProductStatus.Inactive,
      });
      anotherProduct.productId = await productManager.createProduct(
        anotherProduct,
        { corpJwt },
      );

      const anotherOrder = ModelFactory.order({
        product: {
          ...anotherProduct,
          productType: anotherProduct.productTypeId,
        },
        state: OrderState.Complete,
      });

      await orderCompleteHandler.handleMessage(routingKey, anotherOrder);
      const anotherProductSales = await productSalesManager.findOne({
        by: { productId: anotherProduct.productId },
      });
      expect(anotherProductSales.productId).to.equal(anotherProduct.productId);
      expect(anotherProductSales.completedOrders).to.equal(1);
    });
  });
});
