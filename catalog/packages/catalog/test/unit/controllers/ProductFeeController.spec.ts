import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductFeeController } from '../../../src/controllers/ProductFeeController';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductFeeController - Unit', () => {
  let controller: ProductFeeController;
  let mockFeeDao: sinon.SinonMock;
  let mockProductMan: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = Container.get(ProductFeeController);
    mockFeeDao = sinon.mock((controller as any).feeDao);
    mockProductMan = sinon.mock((controller as any).productMan);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('find', () => {
    it('should find fees according to productType of product', async () => {
      const customerId = 'I-123456';
      const siteId = '11111';
      const product = ModelFactory.product({
        purchaseTypes: ['rental'],
        meta: {
          basePrice: { rental: 10.88 },
          name: 'Test',
        } as any,
      });
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(product.productId, false, {}, { customerId, siteId })
        .returns(product);
      const fees = [
        ModelFactory.fee({ amount: 1, percent: false, name: 'Global Fee' }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee',
          customerId,
        }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee With Clause',
          customerId,
          clauses: [{ meta: { name: 'Test' } }],
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: 'Site Fee',
          customerId,
          siteId,
        }),
        ModelFactory.fee({
          amount: 1,
          percent: false,
          name: 'Site Fee with Clause',
          customerId,
          siteId,
        }),
        ModelFactory.fee({
          amount: 0,
          percent: false,
          name: 'No fee',
          customerId,
          siteId,
          clauses: [{ meta: { name: 'Test' } }],
        }),
        ModelFactory.fee({
          amount: 0.2,
          percent: false,
          name: 'No match',
          customerId,
          siteId,
          clauses: [{ meta: { name: 'No match' } }],
        }),
      ];
      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      const feeIds = [
        fees[0].feeId,
        fees[1].feeId,
        fees[2].feeId,
        fees[3].feeId,
        fees[4].feeId,
        fees[5].feeId,
      ];
      mockFeeDao
        .expects('find')
        .withArgs(sinon.match({ ids: feeIds }))
        .resolves([]);
      await controller.find(
        { query: {} } as any,
        `${product.productId}`,
        'I-123456',
        '11111',
      );
      mockProductMan.verify();
      mockFeeDao.verify();
    });
  });
});
