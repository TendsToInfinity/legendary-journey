import { _ } from '@securustablets/libraries.utils';
import { Waiter } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import { Container } from 'typescript-ioc';
import { CatalogService } from '../../../src/CatalogService';
import { BlockReason } from '../../../src/controllers/models/BlockReason';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { ProductManager } from '../../../src/lib/ProductManager';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('ProductManager - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true, cache: true });
  let productMan: ProductManager;
  let productTypeDao: ProductTypeDao;
  let movieSchema: Schema;

  before(async () => {
    await CatalogService.bindAll();
    productTypeDao = new ProductTypeDao();
    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
  });

  beforeEach(async () => {
    productMan = new ProductManager();
  });

  /**
   * Main flow tested as part of create/ update or upsert integration tests
   */
  describe('blockAutoReviewHandler', () => {
    it('should block a product based on case-insensitive term matching', async function () {
      await client.createBlockTerm(['MiXeD', 'lower', 'UPPER'], 'movie');
      // Wait for LIE processing of block term
      await Bluebird.delay(500);

      const sourceProducts = [
        ModelFactory.productFromSchema(movieSchema, {
          meta: { name: 'mIxEd' },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          meta: { name: 'LOWER' },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          meta: { name: 'upper' },
        }),
      ];
      await Bluebird.map(sourceProducts, async (p) => {
        await client.createProduct(p);
      });

      // Wait for LIE processing of product create
      let reasons: BlockReason[];
      await Container.get(Waiter).waitUntil(
        async () => {
          reasons = (await client.fbqsBlockReasons({})).data;
          if (reasons.length !== 3) {
            throw new Error('not enough reasons');
          }
        },
        { timeout: 4000, interval: 500, name: 'Wait for blockReason' },
      );

      const products = await productMan.find();
      products.forEach((p) => {
        const productReasons: BlockReason[] = _.filter(reasons, [
          'productId',
          p.productId,
        ]);
        expect(p.isBlocked).to.equal(true);

        // only one reason should be created per product
        expect(productReasons.length).to.equal(1);
        expect(
          p.meta.name
            .toLowerCase()
            .includes(productReasons[0].term.toLowerCase()),
        ).to.be.true;
      });
    });
    it('should block a product for multiple terms', async () => {
      await client.createBlockTerm(['PuRpLe', 'PeOpLe', 'EaTeR'], 'movie');
      // Wait for LIE processing of block term
      await Bluebird.delay(500);

      // creating this product will trigger the auto block review
      await client.createProduct(
        ModelFactory.productFromSchema(movieSchema, {
          meta: { name: 'Purple peOPLe EATER' },
        }),
      );
      let reasons: BlockReason[];
      await Container.get(Waiter).waitUntil(
        async () => {
          reasons = (await client.fbqsBlockReasons({})).data;
          if (reasons.length !== 3) {
            throw new Error('not enough reasons');
          }
        },
        { timeout: 4000, interval: 500, name: 'Wait for blockReason' },
      );

      const products = await productMan.find();
      products.forEach((p) => {
        const productReasons: BlockReason[] = _.filter(reasons, [
          'productId',
          p.productId,
        ]);
        expect(p.isBlocked).to.equal(true);

        // there should be multiple reasons for the one product
        expect(productReasons.length).to.equal(3);
      });
    });
  });
});
