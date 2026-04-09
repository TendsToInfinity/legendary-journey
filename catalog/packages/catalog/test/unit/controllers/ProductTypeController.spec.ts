import { CorpJwt } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductTypeController } from '../../../src/controllers/ProductTypeController';
import { ProductType } from '../../../src/lib/models/ProductType';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductTypeController - Unit', () => {
  let controller: ProductTypeController;
  let mockManager: sinon.SinonMock;

  beforeEach(() => {
    controller = Container.get(ProductTypeController);
    mockManager = sinon.mock((controller as any).productTypeMan);
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('getProductType', () => {
    it('should call ProductTypeManager.getProductType', async () => {
      mockManager
        .expects('getProductType')
        .withArgs('movie', { customerId: undefined, siteId: undefined })
        .resolves(ModelFactory.productType());
      await controller.getProductType('movie', {});
      mockManager.verify();
    });
    it('should call ProductTypeManager.getProductType with a context', async () => {
      mockManager
        .expects('getProductType')
        .withArgs('movie', { customerId: 'customerId', siteId: 'siteId' })
        .resolves(ModelFactory.productType());
      await controller.getProductType('movie', {}, 'customerId', 'siteId');
      mockManager.verify();
    });
    it('should call ProductTypeManager.getProductType with enforced context for inmateJwt', async () => {
      mockManager
        .expects('getProductType')
        .withArgs('movie', {
          enforce: true,
          customerId: 'customerId',
          siteId: 'siteId',
        })
        .resolves(ModelFactory.productType());
      await controller.getProductType(
        'movie',
        {
          inmateJwt: SecurityFactory.inmateJwt({
            customerId: 'customerId',
            siteId: 'siteId',
          }),
        },
        'im lying',
        'still lying',
      );
      mockManager.verify();
    });
  });
  describe('getProductTypes', () => {
    it('should call ProductTypeManager.getProductTypes', async () => {
      mockManager
        .expects('getProductTypes')
        .withArgs({ customerId: undefined, siteId: undefined })
        .resolves(_.range(10).map(() => ModelFactory.productType()));
      await controller.getProductTypes({});
      mockManager.verify();
    });
    it('should call ProductTypeManager.getProductTypes with a context', async () => {
      mockManager
        .expects('getProductTypes')
        .withArgs({ customerId: 'customerId', siteId: 'siteId' })
        .resolves(_.range(10).map(() => ModelFactory.productType()));
      await controller.getProductTypes({}, 'customerId', 'siteId');
      mockManager.verify();
    });
    it('should call ProductTypeManager.getProductTypes with enforced context for inmateJwt', async () => {
      mockManager
        .expects('getProductTypes')
        .withArgs({ enforce: true, customerId: 'customerId', siteId: 'siteId' })
        .resolves(_.range(10).map(() => ModelFactory.productType()));
      await controller.getProductTypes(
        {
          inmateJwt: SecurityFactory.inmateJwt({
            customerId: 'customerId',
            siteId: 'siteId',
          }),
        },
        'im lying',
        'still lying',
      );
      mockManager.verify();
    });
  });
  describe('getProductTypeAggregations', () => {
    it('should call ProductTypeManager.getProductTypeAggregations', async () => {
      mockManager.expects('getProductTypeAggregations').resolves();
      await controller.getProductTypeAggregations('myProductType');
      mockManager.verify();
    });
  });
  describe('update', () => {
    let corpJwt: CorpJwt;
    beforeEach(() => {
      corpJwt = SecurityFactory.corpJwt();
    });
    it('should update its Meta', async () => {
      const existingProductType = ModelFactory.productType();
      const requestProductType: ProductType = {
        ...existingProductType,
        meta: {
          displayName: faker.random.word(),
          globalAvailability: faker.random.boolean(),
          autoIngest: faker.random.boolean(),
          telemetry: faker.random.boolean(),
          restrictedAccess: faker.random.boolean(),
        },
      };
      mockManager
        .expects('getProductType')
        .withExactArgs(existingProductType.productTypeId)
        .resolves(existingProductType);
      mockManager
        .expects('update')
        .withExactArgs(
          existingProductType.productTypeId,
          { meta: requestProductType.meta },
          { corpJwt },
        );
      await controller.update(
        existingProductType.productTypeId,
        requestProductType,
        { corpJwt },
      );
      mockManager.verify();
    });
    it('should only allowed to update its Meta', async () => {
      const existingProductType = ModelFactory.productType({ available: true });
      mockManager
        .expects('getProductType')
        .withExactArgs(existingProductType.productTypeId)
        .resolves(existingProductType);
      mockManager.expects('update').never();
      const requestProductType: ProductType = {
        ...existingProductType,
        available: false,
      };
      try {
        await controller.update(
          existingProductType.productTypeId,
          requestProductType,
          { corpJwt },
        );
        assert.fail();
      } catch (e) {
        assert.equal(e.code, 400);
        assert.equal(e.errors[0], 'Only updates to "meta" are allowed');
      }
      mockManager.verify();
    });
  });
});
