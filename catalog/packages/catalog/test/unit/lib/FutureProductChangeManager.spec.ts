import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { FutureProductChangeManager } from '../../../src/lib/FutureProductChangeManager';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FutureProductChangeManager - Unit', () => {
  const sandbox = sinon.createSandbox();
  let manager: FutureProductChangeManager;
  let mockDao: sinon.SinonMock;

  beforeEach(() => {
    manager = new FutureProductChangeManager();

    mockDao = sandbox.mock((manager as any).futureProductChangeDao);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('findFutureProductChange', () => {
    it('calls the futureProductChangeDao findFutureProductByVendorAndDate to get the future product', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      mockDao
        .expects('findFutureProductByVendorAndDate')
        .withExactArgs(
          futureProduct.vendorProductId,
          futureProduct.vendorName,
          futureProduct.actionDate,
          futureProduct.productTypeId,
          futureProduct.ingestionBatchId,
        )
        .resolves([futureProduct]);

      const result = await manager.findFutureProductChange(futureProduct);
      expect(result).to.deep.equal([futureProduct]);
      mockDao.verify();
    });

    it('calls the futureProductChangeDao findFutureProductByVendorAndDate to get the future product', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      mockDao
        .expects('findFutureProductByVendorAndDate')
        .withExactArgs(
          futureProduct.vendorProductId,
          futureProduct.vendorName,
          futureProduct.actionDate,
          futureProduct.productTypeId,
          futureProduct.ingestionBatchId,
        )
        .resolves(undefined);

      const result = await manager.findFutureProductChange(futureProduct);
      expect(result).to.deep.equal(undefined);
      mockDao.verify();
    });
  });

  describe('isProductsToUpdateExist', () => {
    it('returns true when there are products to update', async () => {
      mockDao.expects('exists').resolves(true);

      const result = await manager.isProductsToUpdateExist();
      expect(result).to.be.true;
      sinon.verify();
    });

    it('returns false when there are no products to update', async () => {
      mockDao.expects('exists').resolves(false);

      const result = await manager.isProductsToUpdateExist();
      expect(result).to.be.false;
      sinon.verify();
    });
  });
});
