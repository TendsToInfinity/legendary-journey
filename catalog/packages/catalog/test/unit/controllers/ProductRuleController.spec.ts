import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductRuleController } from '../../../src/controllers/ProductRuleController';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductRuleController - Unit', () => {
  let controller: ProductRuleController;
  let mockProductDao: sinon.SinonMock;
  let mockDigestManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = Container.get(ProductRuleController);
    mockProductDao = sinon.mock((controller as any).productDao);
    mockDigestManager = sinon.mock((controller as any).digestManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('find', () => {
    it('should find ruleIds from product dao and use ruleDao for pagination', async () => {
      const product = ModelFactory.product();
      const rules = [
        ModelFactory.rule({ ruleId: 1 }),
        ModelFactory.rule({ ruleId: 2 }),
      ];
      mockDigestManager
        .expects('getDigestRulesByContext')
        .withExactArgs({ customerId: 'I-123456', siteId: '11111' })
        .resolves(rules);
      mockProductDao.expects('findOneOrFail').withArgs(1).resolves(product);
      mockDigestManager
        .expects('getProductDigest')
        .returns({ ruleIds: [1, 2] });
      await controller.find({ query: {} } as any, '1', 'I-123456', '11111');
      mockProductDao.verify();
      mockDigestManager.verify();
    });
  });
});
