import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TestController } from '../../../src/controllers/TestController';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('TestController - Unit', () => {
  let controller: TestController;
  let mockConfig: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = new TestController();
    mockConfig = sinon.mock((controller as any).config);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('bulk', () => {
    it('should bulk load products', async () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();
      const response = { sendStatus: (i) => undefined };
      const mockResponse = sinon.mock(response);
      const createProductStub = sinon.stub(controller as any, 'createProduct');

      mockResponse.expects('sendStatus').withExactArgs(204);

      await controller.bulk([product1, product2], response as any);

      expect(
        createProductStub.calledWithExactly({}, product1, 'bulkApi'),
      ).to.equal(true);
      expect(
        createProductStub.calledWithExactly({}, product2, 'bulkApi'),
      ).to.equal(true);

      mockResponse.verify();
    });
    it('should throw error when test apis are disallowed', async () => {
      mockConfig.expects('get').withArgs('allowTestApis').returns(false);
      try {
        await controller.bulk([], {} as any);
        expect.fail();
      } catch (err) {
        expect(err.code).to.equal(403);
      }
      mockConfig.verify();
    });
  });
  describe('wipe', () => {
    it('should throw error when test apis are disallowed', async () => {
      mockConfig.expects('get').withArgs('allowTestApis').returns(false);
      try {
        await controller.wipe();
        expect.fail();
      } catch (err) {
        expect(err.code).to.equal(403);
      }
      mockConfig.verify();
    });
  });
  describe('createProduct', () => {
    let mockProductManager: sinon.SinonMock;

    beforeEach(() => {
      mockProductManager = sinon.mock((controller as any).productManager);
    });

    it('creates products', async () => {
      const product1Id = 1;
      const product1 = ModelFactory.product({ productId: product1Id });
      const newProduct1Id = 78;
      const product2Id = 21;
      const newProduct2Id = 79;
      const product2 = ModelFactory.product({
        productId: product2Id,
        childProductIds: [product1Id],
        childProducts: [product1],
      });
      const idMap = {};
      const apiKey = 'test';

      mockProductManager
        .expects('createProduct')
        .withExactArgs(product1, { apiKey })
        .resolves(newProduct1Id);
      mockProductManager
        .expects('createProduct')
        .withExactArgs(product2, { apiKey })
        .resolves(newProduct2Id);

      await (controller as any).createProduct(idMap, product2, apiKey);

      expect(product2.childProductIds).to.deep.equal([newProduct1Id]);
      expect(idMap).to.deep.equal({
        [product1Id]: newProduct1Id,
        [product2Id]: newProduct2Id,
      });

      mockProductManager.verify();
    });
  });
});
