import { AuditHistory } from '@securustablets/libraries.audit-history';
import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { ProductStatus } from '../../../../db/reference/Product';
import { CatalogService } from '../../../../src/CatalogService';
import { FutureProductChange } from '../../../../src/controllers/models/FutureProductChange';
import { FutureProductChangeDao } from '../../../../src/data/PGCatalog/FutureProductChangeDao';
import { ProductDao } from '../../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { FutureProductChangeManager } from '../../../../src/lib/FutureProductChangeManager';
import {
  FutureProductChangeUpdateJob,
  ProductsToUpdateStatus,
  ProductsUpdateJobStatus,
} from '../../../../src/lib/jobs/FutureProductChangeUpdateJob';
import { FutureProductChangesRequestHandler } from '../../../../src/messaging/handlers/FutureProductChangeRequestHandler';
import { ModelFactory } from '../../../utils/ModelFactory';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';
import '../../global.spec';

export const catalogService = Container.get(CatalogService) as CatalogService;
export const app = catalogService.app;

describe('FutureProductChangeUpdateJob - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let futureProductChangeUpdateJob: FutureProductChangeUpdateJob;
  let futureProductUpsertRequestHandler: FutureProductChangesRequestHandler;
  let futureProductManager: FutureProductChangeManager;
  let futureProductChangeDao: FutureProductChangeDao;
  let testToken: any;

  before(async () => {
    testToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );
  });

  beforeEach(() => {
    futureProductChangeUpdateJob = new FutureProductChangeUpdateJob();
    futureProductUpsertRequestHandler =
      new FutureProductChangesRequestHandler();
    futureProductManager = new FutureProductChangeManager();
    futureProductChangeDao = new FutureProductChangeDao();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('execute', () => {
    it('should run execute, but get 0 updates', async () => {
      const params = {
        pageNumber: '0',
        pageSize: '250',
        total: 'false',
        state: 'pending',
      };
      const pendingFutureProducts =
        await futureProductChangeDao.findFutureProducts(params);
      pendingFutureProducts.data.map(async (fp) => {
        await futureProductChangeDao.update(
          fp.futureProductChangeId,
          { state: 'complete' },
          {},
        ); // if record exists then set their state to complete
      });

      const result = await futureProductChangeUpdateJob.execute();
      const expectedResult: ProductsUpdateJobStatus = {
        status: 'Nothing to update. The update is stopped',
      };
      expect(result).deep.equal(expectedResult);
    });

    it('should run execute and get the result', async () => {
      await createFutureProductChanges();
      const result = await futureProductChangeUpdateJob.execute();
      const expectedResult: ProductsUpdateJobStatus = {
        status: 'The update has been started',
      };
      expect(result).deep.equal(expectedResult);
    });

    it('should run execute, but gets an error state Unable to find product', async () => {
      const productChange = await createFutureProductChanges();
      const result = await futureProductChangeUpdateJob.execute();
      const expectedResult: ProductsUpdateJobStatus = {
        status: 'The update has been started',
      };
      expect(result).deep.equal(expectedResult);

      const statusMet = await waitForStatus('The update is not running', 10);
      expect(statusMet).equal(
        true,
        'The expected job status was not met after 10 tries',
      );

      const foundProduct =
        await futureProductManager.findFutureProductChange(productChange);
      expect(foundProduct.length).equal(1);
      expect(foundProduct[0].state).equal('error');
      expect(foundProduct[0].error).equal(
        'Unable to find product using vendorProductId and vendorName',
      );
    });

    it('should run execute and get updated product with updated and added fields', async () => {
      const productTypeDao = new ProductTypeDao();

      const productChange = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: 1111 } },
          source: {
            msrp: 'msrpUpdated',
            wholesalePrice: 'wholesalePriceUpdated',
            newField: 'new',
          },
        },
      });
      await futureProductUpsertRequestHandler.handleMessage('test', {
        futureProductChanges: [productChange],
      });
      const schema = (
        await productTypeDao.findOneOrFail(productChange.productTypeId)
      ).jsonSchema;

      const productDao = new ProductDao();

      const productToUpdate = ModelFactory.productFromSchema(schema, {
        status: ProductStatus.Active,
        meta: {
          name: 'Name',
          description: 'Description',
          basePrice: {
            purchase: 0, // will be changed
          },
        },
        source: {
          ingestionBatchId: productChange.ingestionBatchId,
          vendorProductId: productChange.vendorProductId,
          vendorName: productChange.vendorName,
          msrp: 'msrp', // will be changed
          wholesalePrice: 'wholesalePrice', // will be changed
        },
      } as any);

      const productId = await productDao.create(productToUpdate, {
        apiKey: 'test',
      });
      const productBeforeUpdate = await productDao.findOneOrFail(productId);

      const productAuditHistoryBeforeChange = await getAuditHistory({
        entityId: productId,
        entityType: 'product',
      });

      expect(productAuditHistoryBeforeChange.length).deep.equal(3);

      const expectedProduct = _.merge(productBeforeUpdate, {
        ...productChange.action,
        version: 2,
      });
      const result = await futureProductChangeUpdateJob.execute();
      const expectedResult: ProductsUpdateJobStatus = {
        status: 'The update has been started',
      };
      expect(result).deep.equal(expectedResult);

      const statusMet = await waitForStatus('The update is not running', 10);
      expect(statusMet).equal(
        true,
        'The expected job status was not met after 10 tries',
      );

      const foundProductChange =
        await futureProductManager.findFutureProductChange(productChange);
      const changedProduct = await productDao.findOneOrFail(productId);

      const productAuditHistoryAfterChange = await getAuditHistory({
        entityId: productId,
        entityType: 'product',
      });
      expect(productAuditHistoryAfterChange.length).equal(4);
      expect(productAuditHistoryAfterChange[3].context).deep.equal({
        source: 'FUTURE_PRODUCT_CHANGE',
        future_product_change_id: `${foundProductChange[0].futureProductChangeId}`,
      }); // the history has the future product change update
      expect(productAuditHistoryAfterChange[3].document).have.property('tsv');
      expect(productAuditHistoryAfterChange[3].document).have.property(
        'version',
      );
      expect(productAuditHistoryAfterChange[3].document).have.property('cdate');
      expect(productAuditHistoryAfterChange[3].document).have.property('udate');

      expect(foundProductChange.length).equal(1);
      expect(_.omit(changedProduct, 'udate')).deep.equal(
        _.omit(expectedProduct, 'udate'),
      ); // the updated product was updated as expected

      expect(foundProductChange[0].state).equal('complete'); // the product change record updated with complete state
      expect(foundProductChange[0].productId).equal(productId); // the productId for the product change record updated with the actual productId
    });
    it('should run execute and skip product changes if ingestionBatchId does not match', async () => {
      const productTypeDao = new ProductTypeDao();
      const oldIngestionBatch = '1';
      const newIngestionBatch = '2';

      const productChange = ModelFactory.futureProduct({
        ingestionBatchId: oldIngestionBatch,
        action: {
          source: {
            availableForPurchase: true,
            availableForSubscription: false,
          },
        },
      });
      await futureProductUpsertRequestHandler.handleMessage('test', {
        futureProductChanges: [productChange],
      });
      const schema = (
        await productTypeDao.findOneOrFail(productChange.productTypeId)
      ).jsonSchema;

      const productDao = new ProductDao();

      const productToUpdate = ModelFactory.productFromSchema(schema, {
        status: ProductStatus.Active,
        source: {
          ingestionBatchId: newIngestionBatch,
          vendorProductId: productChange.vendorProductId,
          vendorName: productChange.vendorName,
          availableForPurchase: false,
          availableForSubscription: false,
        },
      } as any);

      const productId = await productDao.create(productToUpdate, {
        apiKey: 'test',
      });

      const result = await futureProductChangeUpdateJob.execute();
      const expectedResult: ProductsUpdateJobStatus = {
        status: 'The update has been started',
      };
      expect(result).deep.equal(expectedResult);

      const statusMet = await waitForStatus('The update is not running', 10);
      expect(statusMet).equal(
        true,
        'The expected job status was not met after 10 tries',
      );

      const foundProductChange =
        await futureProductManager.findFutureProductChange(productChange);
      const changedProduct = await productDao.findOneOrFail(productId);

      expect(foundProductChange.length).equal(1);
      expect(changedProduct.source.availableForSubscription).to.be.false;
      expect(changedProduct.source.availableForPurchase).to.be.false;

      expect(foundProductChange[0].state).equal('cancelled'); // the product change record updated with complete state
    });
  });

  describe('getCurrentJobStatus', () => {
    it('should run getCurrentJobStatus and the update not started yet', async () => {
      const result = await futureProductChangeUpdateJob.getCurrentJobStatus();
      const expectedResult: ProductsToUpdateStatus = {
        status: 'The update is not running',
        count: 0,
      };
      expect(result).deep.equal(expectedResult);
    });

    it('should run getCurrentJobStatus after execute, get The update is finished', async () => {
      await createFutureProductChanges();
      await futureProductChangeUpdateJob.execute();
      const statusMet = await waitForStatus('The update is not running', 10);
      expect(statusMet).equal(
        true,
        'The expected job status was not met after 10 tries',
      );
    });
  });

  async function createFutureProductChanges(): Promise<FutureProductChange> {
    const fakedFutureProduct = ModelFactory.futureProduct({
      action: {
        meta: { basePrice: { purchase: faker.random.number() } },
        source: {
          msrp: faker.random.alphaNumeric(10),
          wholesalePrice: faker.random.word(),
          newField: 'new',
        },
      },
    });

    await futureProductUpsertRequestHandler.handleMessage('test', {
      futureProductChanges: [fakedFutureProduct],
    });

    await Bluebird.delay(500);
    return fakedFutureProduct;
  }

  async function waitForStatus(
    statusToWait: string,
    tries: number,
  ): Promise<boolean> {
    return await new Promise((resolve) => {
      setTimeout(async () => {
        const { status } =
          await futureProductChangeUpdateJob.getCurrentJobStatus();
        if (tries <= 0) {
          return resolve(false);
        }
        if (status !== statusToWait) {
          tries--;
          return resolve(await waitForStatus(statusToWait, tries));
        }
        return resolve(true);
      }, 50);
    });
  }

  async function getAuditHistory(params: any): Promise<AuditHistory[]> {
    const res1 = await request(app)
      .get(`/audits`)
      .set('Authorization', `Bearer ${testToken}`)
      .send(params)
      .expect(200);

    return res1.body.data;
  }
});
