import { InmateJwt } from '@securustablets/libraries.httpsecurity';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import {
  ProductStatus,
  ProductTypeIds,
} from '../../../src/controllers/models/Product';
import { ProductManager } from '../../../src/lib/ProductManager';
import { ProductSalesManager } from '../../../src/lib/ProductSalesManager';
import { app } from '../../../src/main';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('ProductSalesManager - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let inmateJwt: InmateJwt;
  let productManager: ProductManager;
  let productSalesManager: ProductSalesManager;

  let customerId: string;
  let siteId: string;

  before(() => {
    productManager = Container.get(ProductManager);
    productSalesManager = Container.get(ProductSalesManager);
  });

  beforeEach(async () => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    await request(app)
      .get(`/test/cache/clear`)
      .set('X-API-KEY', `API_KEY_DEV`)
      .expect(204);

    customerId = `I-${faker.random.number(6)}`;
    siteId = faker.random.alphaNumeric(5).trim();

    inmateJwt = SecurityFactory.inmateJwt({ customerId, siteId });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('incrementCompletedOrders', () => {
    it('should increment completedOrders in Postgres and totalSales in OpenSearch', async () => {
      const artist = ModelFactory.product({
        productTypeId: ProductTypeIds.Artist,
      });
      artist.productId = await productManager.createProduct(artist, {
        apiKey: 'test',
      });

      const product = ModelFactory.product({
        status: ProductStatus.Inactive,
        source: {
          productTypeId: 'movie',
          url: 'www.test.local',
          vendorArtistId: artist.source.vendorProductId,
          vendorName: artist.source.vendorName,
        },
      });
      product.productId = await productManager.createProduct(product, {
        apiKey: 'test',
      });

      const completedOrders: number = faker.random.number(100);

      const productSales = ModelFactory.productSales({
        productId: product.productId,
        productTypeId: product.productTypeId,
        completedOrders,
      });
      productSales.productSalesId =
        await productSalesManager.createProductSales(productSales, {
          inmateJwt,
        });

      await productSalesManager.incrementCompletedOrders(
        productSales.productSalesId,
        productSales.productId,
        productSales.productTypeId,
        artist.productId,
      );

      await Bluebird.delay(500);

      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .expect(204);

      await Bluebird.delay(500);

      const { body } = await request(app)
        .post(`/products/search`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .send({
          query: {
            productTypeId: 'movie',
            clauses: {
              productId: [product.productId],
            },
          },
          context: {
            enforce: false,
          },
          pageNumber: 0,
          pageSize: 10,
          total: false,
        })
        .expect(200);

      expect(body.data[0].digest.sales.totalSales).to.equal(
        completedOrders + 1,
      );
    });

    it('should decrement completedOrders in Postgres and totalSales in OpenSearch', async () => {
      const artist = ModelFactory.product({
        productTypeId: ProductTypeIds.Artist,
      });
      artist.productId = await productManager.createProduct(artist, {
        apiKey: 'test',
      });

      const product = ModelFactory.product({
        status: ProductStatus.Inactive,
        source: {
          productTypeId: 'movie',
          url: 'www.test.local',
          vendorArtistId: artist.source.vendorProductId,
          vendorName: artist.source.vendorName,
        },
      });
      product.productId = await productManager.createProduct(product, {
        apiKey: 'test',
      });

      const completedOrders: number = 60;

      const productSales = ModelFactory.productSales({
        productId: product.productId,
        productTypeId: product.productTypeId,
        completedOrders,
      });
      productSales.productSalesId =
        await productSalesManager.createProductSales(productSales, {
          inmateJwt,
        });

      await productSalesManager.incrementCompletedOrders(
        productSales.productSalesId,
        productSales.productId,
        productSales.productTypeId,
        artist.productId,
      );

      // await Bluebird.delay(1000);

      const { body: newProductSalesResponse } = await request(app)
        .get(`/productSales`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .query({ productSalesId: productSales.productSalesId })
        .expect(200);

      const newProductSales = newProductSalesResponse.data[0];
      const decrementedCompletedOrders = newProductSales.completedOrders - 5;
      newProductSales.completedOrders = decrementedCompletedOrders;

      await Bluebird.delay(500);

      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .expect(204);

      await request(app)
        .put(`/productSales/${newProductSales.productSalesId}`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .send(newProductSales)
        .expect(204);

      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .expect(204);

      await Bluebird.delay(1000);

      const { body: productSearchResponse } = await request(app)
        .post(`/products/search`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .send({
          query: {
            productTypeId: 'movie',
            clauses: {
              productId: [product.productId],
            },
          },
          context: {
            enforce: false,
          },
          pageNumber: 0,
          pageSize: 10,
          total: false,
        })
        .expect(200);

      expect(productSearchResponse.data[0].digest.sales.totalSales).to.equal(
        decrementedCompletedOrders,
      );
    });
  });
});
