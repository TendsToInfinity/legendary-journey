import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductAvailabilityController } from '../../../src/controllers/ProductAvailabilityController';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';

describe('ProductAvailabilityController - Unit', () => {
  let controller: ProductAvailabilityController;
  let mockDao: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = Container.get(ProductAvailabilityController);
    mockDao = sinon.mock((controller as any).productDao);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findOne', () => {
    it('should call productDao', async () => {
      mockDao.expects('findProductAvailabilityOrFail').withArgs(1);
      await controller.findOne('1');
      mockDao.verify();
    });
  });
});
