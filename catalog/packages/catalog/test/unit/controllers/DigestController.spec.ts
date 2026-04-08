import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { DigestController } from '../../../src/controllers/DigestController';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('DigestController - Unit', () => {
  let digestController: DigestController;
  let mockProductManager: sinon.SinonMock;
  let mockOpenSearchManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    digestController = new DigestController();
    mockProductManager = sinon.mock((digestController as any).productManager);
    mockOpenSearchManager = sinon.mock(
      (digestController as any).openSearchManager,
    );
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('digestProducts', () => {
    it('should digest products and return them', async () => {
      const productTypeId = 'movie';
      const search = { pageSize: 101, pageNumber: 10 };
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      const digestedProducts = products.map((i) => ({
        ...i,
        digest: ModelFactory.digest(),
      }));
      mockProductManager
        .expects('findByQueryString')
        .withExactArgs({ productTypeId })
        .resolves({ data: products, ...search });
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(products)
        .resolves(digestedProducts);
      const result = await digestController.digestProducts(
        { query: {} } as Request,
        productTypeId,
      );
      expect(result).to.deep.equal({ ...search, data: digestedProducts });
      mockProductManager.verify();
      mockOpenSearchManager.verify();
    });
  });
});
