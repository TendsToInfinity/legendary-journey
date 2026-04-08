// tslint:disable-next-line: ordered-imports
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { FutureProductChangeController } from '../../../src/controllers/FutureProductChangesController';
import { ProductsToUpdateStatus } from '../../../src/lib/jobs/FutureProductChangeUpdateJob';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FutureProductChangesController - Unit', () => {
  let controller: FutureProductChangeController;
  let mockFutureProductChangeMan: sinon.SinonMock;
  let mockFutureProductChangeUpdateJob: sinon.SinonMock;

  beforeEach(() => {
    controller = new FutureProductChangeController();
    mockFutureProductChangeMan = sinon.mock(
      (controller as any).futureProductChangeMan,
    );
    mockFutureProductChangeUpdateJob = sinon.mock(
      (controller as any).futureProductChangeUpdateJob,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('controller', () => {
    it('should find and return products', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const params = {
        vendorProductId: futureProduct.vendorProductId,
        vendorName: futureProduct.vendorName,
        state: futureProduct.state,
        actionDate: futureProduct.actionDate,
        productTypeId: futureProduct.productTypeId,
      };

      mockFutureProductChangeMan
        .expects('findFutureProducts')
        .resolves([futureProduct]);

      const result = await controller.find(params as any);

      expect(result).to.deep.equal([futureProduct]);

      sinon.verify();
    });

    it('calls the futureProductChangeUpdateJob execute to run the update job and return a job status', async () => {
      const expectedResult = {
        status: 'The update has been started',
        count: 1,
      } as ProductsToUpdateStatus;
      mockFutureProductChangeUpdateJob
        .expects('execute')
        .resolves(expectedResult);

      const result = await controller.runUpdate();

      sinon.verify();
      expect(result).to.deep.equal(expectedResult);
    });

    it('calls the futureProductChangeUpdateJob return a job status', async () => {
      const expectedResult = {
        status: 'The update is running',
        count: 10,
      } as ProductsToUpdateStatus;
      mockFutureProductChangeUpdateJob
        .expects('getCurrentJobStatus')
        .resolves(expectedResult);

      const result = await controller.getCurrentJobStatus();

      sinon.verify();
      expect(result).to.deep.equal(expectedResult);
    });
  });
});
