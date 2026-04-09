import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { CatalogService } from '../../../../src/CatalogService';
import { FutureProductChangeManager } from '../../../../src/lib/FutureProductChangeManager';
import { FutureProductChangesRequestHandler } from '../../../../src/messaging/handlers/FutureProductChangeRequestHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('FutureProductChangeRequestHandler - Integration', () => {
  let futureProductMan: FutureProductChangeManager;
  let futureProductUpsertRequestHandler: FutureProductChangesRequestHandler;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    futureProductMan = new FutureProductChangeManager();
    futureProductUpsertRequestHandler =
      new FutureProductChangesRequestHandler();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage - future', () => {
    it('should create new future product', async () => {
      const routingKey = 'test';
      const fakedFutureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct],
      });

      await Bluebird.delay(500);
      const result =
        await futureProductMan.findFutureProductChange(fakedFutureProduct);

      expect(result).to.be.not.null;
      expect(result.length).to.equal(1);
      expect(result[0].productId).to.be.null;
      expect(result[0].productTypeId).to.equal(
        fakedFutureProduct.productTypeId,
      );
      expect(result[0].ingestionBatchId).to.equal(
        fakedFutureProduct.ingestionBatchId,
      );
      expect(new Date(result[0].actionDate).toISOString()).to.equal(
        fakedFutureProduct.actionDate,
      );
      expect(result[0].vendorProductId).to.equal(
        fakedFutureProduct.vendorProductId,
      );
      expect(result[0].vendorName).to.equal(fakedFutureProduct.vendorName);
      expect(
        _.omit(
          result[0],
          'futureProductChangeId',
          'productId',
          'error',
          'version',
          'cdate',
          'udate',
          'actionDate',
        ),
      ).to.deep.equal(_.omit(fakedFutureProduct, 'actionDate'));
    });

    it('should update the future products appropriately after creating couple of future products, and updates to other product should not affect the initial product', async () => {
      const routingKey = 'test';
      const fakedFutureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct],
      });

      let fakedFutureProduct1 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct1],
      });

      let fakedFutureProduct2 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct2],
      });

      let fakedFutureProduct3 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct3],
      });
      await Bluebird.delay(500);

      fakedFutureProduct.action.meta.basePrice.purchase = 1.99;
      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct],
      });

      fakedFutureProduct1 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct1],
      });

      fakedFutureProduct2 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct2],
      });

      fakedFutureProduct3 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [fakedFutureProduct3],
      });
      await Bluebird.delay(500);

      const result =
        await futureProductMan.findFutureProductChange(fakedFutureProduct);
      expect(result).to.be.not.null;
      expect(result.length).to.equal(1);
      expect(result[0].productId).to.be.null;
      expect(result[0].productTypeId).to.equal(
        fakedFutureProduct.productTypeId,
      );
      expect(result[0].action.meta.basePrice.purchase).to.equal(1.99);
      expect(result[0].version).to.equal(1);
      expect(new Date(result[0].actionDate).toISOString()).to.equal(
        fakedFutureProduct.actionDate,
      );
      expect(
        _.omit(
          result[0],
          'futureProductChangeId',
          'productId',
          'actionDate',
          'error',
          'version',
          'cdate',
          'udate',
        ),
      ).to.deep.equal(_.omit(fakedFutureProduct, 'actionDate'));
    });

    it('should create 2 new future product', async () => {
      const routingKey = 'test';
      const fakedFutureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      const fakedFutureProduct1 = {
        ...fakedFutureProduct,
        actionDate: faker.date.future().toISOString(),
      };
      const fakedFutureProductArray = [fakedFutureProduct, fakedFutureProduct1];
      await futureProductUpsertRequestHandler.handleMessage(routingKey, {
        futureProductChanges: fakedFutureProductArray,
      });

      await Bluebird.delay(1000);

      let result =
        await futureProductMan.findFutureProductChange(fakedFutureProduct);
      expect(result).to.be.not.null;
      expect(result.length).to.equal(1);
      expect(result[0].productId).to.be.null;
      expect(result[0].productTypeId).to.equal(
        fakedFutureProduct.productTypeId,
      );
      expect(new Date(result[0].actionDate).toISOString()).to.equal(
        fakedFutureProduct.actionDate,
      );
      expect(
        _.omit(
          result[0],
          'futureProductChangeId',
          'productId',
          'actionDate',
          'error',
          'version',
          'cdate',
          'udate',
        ),
      ).to.deep.equal(_.omit(fakedFutureProduct, 'actionDate'));

      result =
        await futureProductMan.findFutureProductChange(fakedFutureProduct1);
      expect(result).to.be.not.null;
      expect(result.length).to.equal(1);
      expect(result[0].productId).to.be.null;
      expect(result[0].productTypeId).to.equal(
        fakedFutureProduct1.productTypeId,
      );
      expect(new Date(result[0].actionDate).toISOString()).to.equal(
        fakedFutureProduct1.actionDate,
      );
      expect(
        _.omit(
          result[0],
          'futureProductChangeId',
          'productId',
          'actionDate',
          'error',
          'version',
          'cdate',
          'udate',
        ),
      ).to.deep.equal(_.omit(fakedFutureProduct1, 'actionDate'));
    });
  });
});
