import { DeepPartial } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { ProductStatus } from '../../../db/reference/Product';
import { FutureProductChange } from '../../../src/controllers/models/FutureProductChange';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { FutureProductChangeUpdateJob } from '../../../src/lib/jobs/FutureProductChangeUpdateJob';
import { app } from '../../../src/main';
import { FutureProductChangesRequestHandler } from '../../../src/messaging/handlers/FutureProductChangeRequestHandler';
import { AppConfig } from '../../../src/utils/AppConfig';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('FutureProductChangesController - Integration', function () {
  IntegrationTestSuite.setUp(this);

  let futureProductUpsertRequestHandler: FutureProductChangesRequestHandler;
  let productTypeDao: ProductTypeDao;
  let futureProductChangeUpdateJob: FutureProductChangeUpdateJob;
  let mockLogger: sinon.SinonMock;

  beforeEach(async () => {
    await client.clearCache();
    productTypeDao = new ProductTypeDao();

    futureProductUpsertRequestHandler =
      new FutureProductChangesRequestHandler();

    futureProductChangeUpdateJob = Container.get(FutureProductChangeUpdateJob);
    mockLogger = sinon.mock((futureProductChangeUpdateJob as any).logger);
  });

  afterEach(() => {
    sinon.restore();
  });

  async function createFutureProductChange(
    overrides: DeepPartial<FutureProductChange> = {},
  ): Promise<FutureProductChange> {
    const routingKey = 'test';

    // default as it was before
    if (Object.keys(overrides).length === 0) {
      overrides = {
        state: 'pending',
        action: {
          meta: { name: 'I was updated!' },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      };
    }
    const fakedFutureProduct = ModelFactory.futureProduct(overrides);
    await futureProductUpsertRequestHandler.handleMessage(routingKey, {
      futureProductChanges: [fakedFutureProduct],
    });

    await Bluebird.delay(500);
    return fakedFutureProduct;
  }

  describe('FutureProductChanges API', () => {
    it(`should find the futureProduct`, async () => {
      const futureProduct = await createFutureProductChange();
      const { body } = await request(app)
        .get(
          `/futureProductChanges?vendorProductId=${futureProduct.vendorProductId}`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body.data[0]).to.have.property('vendorProductId');
      expect(body.data[0].vendorName).equal(futureProduct.vendorName);
    });

    it(`should run the update pending products command and get a status if the update has been started`, async () => {
      await createFutureProductChange();
      const { body } = await request(app)
        .get(`/futureProductChanges/runUpdate`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      const expectedResult = {
        status: 'The update has been started',
      };
      expect(body).deep.equal(expectedResult);
    });

    it(`should get the update job current status for pending products when job is not running and there are no pending products to update`, async () => {
      const { body } = await request(app)
        .get(`/futureProductChanges/getUpdateStatus`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      const expectedResult = {
        status: 'The update is not running',
        count: 0,
      };
      expect(body).deep.equal(expectedResult);
    });

    it(`should get the update job current status for pending products when job is not running and pending products to update are exist`, async () => {
      await createFutureProductChange();
      const { body } = await request(app)
        .get(`/futureProductChanges/getUpdateStatus`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      const expectedResult = {
        status: 'The update is not running',
        count: 1,
      };
      expect(body).deep.equal(expectedResult);
    });
  });

  describe('Future Product Changes Stored Function', () => {
    let appConfig: AppConfig;
    let appConfigGetStub: sinon.SinonStub;

    beforeEach(async () => {
      appConfig = Container.get(AppConfig);
      appConfigGetStub = sinon.stub(appConfig as any, 'get');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('Should create a product and update it with futureProductChanges', async () => {
      const sqsConfig = {
        sqsEnabled: true,
        queueName: 'test-queue',
      };
      const openSearchConfig = {
        host: 'http://catalog.opensearch:9200',
        user: 'admin',
        pass: 'admin',
      };
      // always return the same config
      appConfigGetStub.withArgs('sqsConfig').returns(sqsConfig);
      appConfigGetStub.withArgs('openSearch').returns(openSearchConfig);

      // create a product to update
      const trackSchema = (await productTypeDao.findOneOrFail('track'))
        .jsonSchema;
      const products = [];
      for (let index = 0; index < 120; index++) {
        // bach is 100, so make it 120
        const override = {
          status: ProductStatus.Active,
          meta: {
            name: `test ${index}`,
          },
          source: {
            ingestionBatchId: 1234, // very important to have a batch id!!!
          },
        };
        products.push(
          ModelFactory.productFromSchema(trackSchema, override as any),
        );
      }

      const dbProducts =
        await IntegrationTestSuite.loadProductsAndRules(products);
      const updatedName = 'I was updated!';

      const futureProducts = await Promise.all(
        dbProducts.map(async (product) => {
          return await createFutureProductChange({
            productTypeId: 'track',
            productId: product.productId,
            vendorName: product.source.vendorName,
            vendorProductId: product.source.vendorProductId,
            ingestionBatchId: product.source.ingestionBatchId,
            // date last year
            actionDate: new Date(
              new Date().setFullYear(new Date().getFullYear() - 1),
            ).toISOString(),
            action: {
              meta: { name: updatedName },
            },
          });
        }),
      );

      const { body } = await request(app)
        .get(
          `/futureProductChanges?vendorProductId=${futureProducts[0].vendorProductId}`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body.data[0].vendorName).equal(futureProducts[0].vendorName);

      // run the update
      await request(app)
        .get(`/futureProductChanges/runUpdate`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);

      // get the updated product
      await client.clearCache();
      await Bluebird.delay(500); // idk why clear cache by itself sometimes doesn't work and retune cached data
      const { body: updatedProduct } = await request(app)
        .get(`/products/${dbProducts[0].productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(updatedProduct.meta.name).equal(updatedName);
      mockLogger
        .expects('info')
        .withExactArgs(
          `Publishing song sample download request for product ${dbProducts[0].productId}`,
        )
        .atLeast(1);
    });

    it('Should cancel the futureProductChange if there is no batchId', async () => {
      // product to update
      const override = {
        status: ProductStatus.Active,
        meta: {
          name: `product with cancel batch`,
        },
        source: {
          ingestionBatchId: 1234, // very important to have a batch id!!!
        },
      };
      const trackSchema = (await productTypeDao.findOneOrFail('track'))
        .jsonSchema;
      const dbProducts = await IntegrationTestSuite.loadProductsAndRules([
        ModelFactory.productFromSchema(trackSchema, override as any),
      ]);

      const futureProduct = await createFutureProductChange({
        productTypeId: 'track',
        productId: dbProducts[0].productId,
        vendorName: dbProducts[0].source.vendorName,
        vendorProductId: dbProducts[0].source.vendorProductId,
        ingestionBatchId: undefined,
        // date last year
        actionDate: new Date(
          new Date().setFullYear(new Date().getFullYear() - 1),
        ).toISOString(),
        action: {
          meta: { name: 'Boo' },
        },
      });

      const { body } = await request(app)
        .get(
          `/futureProductChanges?vendorProductId=${futureProduct.vendorProductId}`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body.data[0].state).equal('pending');

      // run the update
      await request(app)
        .get(`/futureProductChanges/runUpdate`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);

      // check that it was canceled
      await Bluebird.delay(500);
      const { body: updatedFutureChange } = await request(app)
        .get(
          `/futureProductChanges?vendorProductId=${futureProduct.vendorProductId}`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(updatedFutureChange.data[0].state).equal('cancelled');
    });
  });
});
