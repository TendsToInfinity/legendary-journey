import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductTypeAvailabilityController } from '../../../src/controllers/ProductTypeAvailabilityController';

describe('ProductTypeAvailabilityController - Unit', () => {
  let controller: ProductTypeAvailabilityController;
  let mockDao: sinon.SinonMock;

  beforeEach(() => {
    controller = Container.get(ProductTypeAvailabilityController);
    mockDao = sinon.mock((controller as any).productTypeDao);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findOne', () => {
    it('should call productTypeDao', async () => {
      mockDao
        .expects('findAvailabilityOrFail')
        .withArgs('movie', { customerId: 'customerId', siteId: 'siteId' })
        .resolves();
      await controller.findOne('movie', 'customerId', 'siteId');
      mockDao.verify();
    });
  });
});
