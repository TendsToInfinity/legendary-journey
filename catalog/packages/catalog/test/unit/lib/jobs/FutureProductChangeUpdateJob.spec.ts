import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { ProductStatus } from '../../../../db/reference/Product';
import { Product } from '../../../../src/controllers/models/Product';
import {
  FutureProductChangeUpdateJob,
  ProductsToUpdateStatus,
  ProductsUpdateJobStatus,
} from '../../../../src/lib/jobs/FutureProductChangeUpdateJob';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('FutureProductChangeUpdateJob - Unit', () => {
  const sandbox = sinon.createSandbox();
  let futureProductChangeUpdateJob: FutureProductChangeUpdateJob;
  let mockFutureProductChangeManager: sinon.SinonMock;
  let mockProductPublishManager: sinon.SinonMock;
  let mockConfig: sinon.SinonMock;

  beforeEach(() => {
    futureProductChangeUpdateJob = new FutureProductChangeUpdateJob();
    mockFutureProductChangeManager = sandbox.mock(
      (futureProductChangeUpdateJob as any).futureProductChangeManager,
    );
    mockProductPublishManager = sandbox.mock(
      (futureProductChangeUpdateJob as any).productPublishManager,
    );
    mockConfig = sandbox.mock((futureProductChangeUpdateJob as any).config);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('execute', () => {
    it('should start update when there are pending products to update', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage

      mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .once()
        .resolves(true);

      const runBatchStub = sinon.stub(futureProductChangeUpdateJob, 'runBatch');
      runBatchStub.resolves();

      const result = await futureProductChangeUpdateJob.execute();

      const expectedResult = {
        status: 'The update has been started',
      } as ProductsUpdateJobStatus;

      mockFutureProductChangeManager.verify();
      expect(runBatchStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(expectedResult);
    });

    it('should not start update when there are no products to update', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage

      mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .once()
        .resolves(false);

      const runBatchStub = sinon.stub(futureProductChangeUpdateJob, 'runBatch');

      const result = await futureProductChangeUpdateJob.execute();

      const expectedResult = {
        status: 'Nothing to update. The update is stopped',
      } as ProductsUpdateJobStatus;

      mockFutureProductChangeManager.verify();
      assert(runBatchStub.notCalled);
      expect(result).to.deep.equal(expectedResult);
    });

    it('should throw InternalError when checking for products to update fails', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage

      mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .once()
        .throws(new Error('error happened'));

      const runBatchStub = sinon.stub(futureProductChangeUpdateJob, 'runBatch');

      try {
        await futureProductChangeUpdateJob.execute();
        assert.fail('Expected error to be thrown');
      } catch (error) {
        expect(error.name).to.equal(Exception.InternalError.name);
        expect(error.errors).to.deep.equal([
          'Batch execute error. Error: error happened',
        ]);
      }
      mockFutureProductChangeManager.verify();
      assert(runBatchStub.notCalled);
    });
  });

  describe('runBatch', () => {
    it('should update products without SQS when SQS feature is disabled', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      mockConfig
        .expects('get')
        .withArgs('sqsConfig')
        .returns({ sqsEnabled: false });

      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage

      const products = [product];

      mockFutureProductChangeManager
        .expects('futureProductPerformChanges')
        .once()
        .resolves(products);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withArgs(product)
        .resolves();

      mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .once()
        .resolves(false);

      await futureProductChangeUpdateJob.runBatch();

      sinon.verify();
    });

    it('should update products and publish song sample download request when SQS is enabled and product lacks sample', async () => {
      mockConfig
        .expects('get')
        .withArgs('sqsConfig')
        .returns({ sqsEnabled: true });
      const jsonSchema = await ModelFactory.testAlbumSchema();
      const product = ModelFactory.productFromSchema(jsonSchema, {
        source: {
          sampleUrl: undefined,
        },
        status: ProductStatus.Active,
      });

      const products = [product];

      mockFutureProductChangeManager
        .expects('futureProductPerformChanges')
        .once()
        .resolves(products);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withArgs(product)
        .resolves();

      mockProductPublishManager
        .expects('publishSongSampleDownloadRequest')
        .withArgs(product)
        .resolves();

      mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .once()
        .resolves(false);

      await futureProductChangeUpdateJob.runBatch();

      sinon.verify();
    });

    it('should process multiple batches until no products remain', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
          isActive: true,
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage

      const products = [product];

      mockFutureProductChangeManager
        .expects('futureProductPerformChanges')
        .twice()
        .resolves(products);

      mockProductPublishManager
        .expects('publishProductMessage')
        .twice()
        .withArgs(product)
        .resolves();

      const isProductsToUpdateExistStub = mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .twice();

      isProductsToUpdateExistStub.onFirstCall().resolves(true);
      isProductsToUpdateExistStub.onSecondCall().resolves(false);

      await futureProductChangeUpdateJob.runBatch();

      sinon.verify();
    });

    it('should not process any products when there are none to update', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage

      mockFutureProductChangeManager
        .expects('isProductsToUpdateExist')
        .once()
        .resolves(false);

      mockFutureProductChangeManager
        .expects('futureProductPerformChanges')
        .once()
        .resolves([]);

      mockProductPublishManager.expects('publishProductMessage').never();

      await futureProductChangeUpdateJob.runBatch();

      sinon.verify();
    });

    it('should throw InternalError when publishProductMessage fails during runBatch', async () => {
      mockConfig
        .expects('get')
        .withArgs('sqsConfig')
        .returns({ sqsEnabled: true });

      const product = ModelFactory.product({
        source: {
          sampleUrl: undefined,
        },
        isActive: true,
      });

      const products = [product];

      mockFutureProductChangeManager
        .expects('futureProductPerformChanges')
        .once()
        .resolves(products);

      const publishStub = mockProductPublishManager
        .expects('publishProductMessage')
        .atMost(4);

      publishStub.onCall(0).throws(new Error('Some error'));
      publishStub.onCall(1).throws(new Error('Some error'));
      publishStub.onCall(2).throws(new Error('Some error'));
      publishStub.onCall(3).throws(new Error('Some error'));

      try {
        await futureProductChangeUpdateJob.runBatch();
        assert.fail('Expected error to be thrown');
      } catch (error) {
        expect(error.name).to.equal(Exception.InternalError.name);
        expect(error.errors).to.deep.equal([
          'Post script error. Error: Some error',
        ]);
      }

      sinon.verify();
    });
  });

  describe('getCurrentJobStatus', () => {
    it('should report status as running with count when job is in progress', async () => {
      futureProductChangeUpdateJob['jobInProgress'] = true;

      mockFutureProductChangeManager
        .expects('productsToUpdateCount')
        .once()
        .resolves(5);

      const status = await futureProductChangeUpdateJob.getCurrentJobStatus();

      const expectedResult = {
        status: 'The update is running',
        count: 5,
      } as ProductsToUpdateStatus;

      expect(status).to.deep.equal(expectedResult);
      sinon.verify();
    });

    it('should report status as not running with zero count when job is not in progress', async () => {
      futureProductChangeUpdateJob['jobInProgress'] = false;

      mockFutureProductChangeManager
        .expects('productsToUpdateCount')
        .once()
        .resolves(0);

      const status = await futureProductChangeUpdateJob.getCurrentJobStatus();

      const expectedResult = {
        status: 'The update is not running',
        count: 0,
      } as ProductsToUpdateStatus;

      expect(status).to.deep.equal(expectedResult);
      sinon.verify();
    });
  });
});
