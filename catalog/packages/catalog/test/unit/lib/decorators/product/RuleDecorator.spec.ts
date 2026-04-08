import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { PricedProduct } from '../../../../../src/controllers/models/Product';
import { RuleType } from '../../../../../src/controllers/models/Rule';
import { RuleDao } from '../../../../../src/data/PGCatalog/RuleDao';
import { RuleDecorator } from '../../../../../src/lib/decorators/product/RuleDecorator';
import { ModelFactory } from '../../../../utils/ModelFactory';

describe('RuleDecorator - Unit', () => {
  const sandbox = sinon.createSandbox();
  let ruleDecorator: RuleDecorator;
  let mockRuleDao: sinon.SinonMock;

  const clauses = [
    {
      meta: {
        year: 'year1',
      },
    },
    {
      meta: {
        year: 'year2',
      },
    },
  ];

  beforeEach(() => {
    ruleDecorator = new RuleDecorator();
    mockRuleDao = sandbox.mock((ruleDecorator as any).ruleDao);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('applyRule', () => {
    let products: PricedProduct[] = [];
    let rules = [];
    const context = { customerId: 'customerId', siteId: 'siteId' };

    beforeEach(() => {
      products = [
        ModelFactory.pricedProduct({
          productId: 123,
          purchaseTypes: ['rental'],
          meta: { year: 'year1' },
        } as any as PricedProduct),
      ];
      rules = [
        {
          ruleId: 1,
          productTypeId: 'movie',
          customerId: 'customerId',
          siteId: 'siteId',
          clause: { meta: { year: 'year1' } },
          action: { cache: true },
        },
        {
          ruleId: 2,
          productTypeId: 'movie',
          customerId: 'customerId',
          action: { cache: false },
        },
      ];
    });

    it('get correct action name', async () => {
      const actionName = (ruleDecorator as any).booleanActionName(
        RuleDao.RULE_TYPE_META[RuleType.ProductCache],
      );
      assert.equal(actionName, 'cache');
    });
    it('isMatch() does correct matching', async () => {
      assert.isTrue((ruleDecorator as any).isMatch(_.first(products), clauses));
    });
    it('default value is applied when no matching clauses', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(context, RuleType.ProductCache)
        .resolves(rules);
      mockRuleDao.expects('aggregateClauses').resolves([]); // whitelist
      mockRuleDao.expects('aggregateClauses').resolves([]); // blacklist

      const actionName = (ruleDecorator as any).booleanActionName(
        RuleDao.RULE_TYPE_META[RuleType.ProductCache],
      );
      const decorator = ruleDecorator.forBoolean(RuleType.ProductCache);
      await decorator(products, context);
      mockRuleDao.verify();

      assert.equal(
        _.get(_.first(products), actionName),
        RuleDao.RULE_TYPE_META[RuleType.ProductCache].default.cache,
      );
    });
    it('matching whitelist clause', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(context, RuleType.ProductCache)
        .resolves(rules);
      mockRuleDao
        .expects('aggregateClauses')
        .resolves([{ meta: { year: 'year1' } }]); // whitelist
      mockRuleDao.expects('aggregateClauses').resolves([]); // blacklist

      const actionName = (ruleDecorator as any).booleanActionName(
        RuleDao.RULE_TYPE_META[RuleType.ProductCache],
      );
      const decorator = ruleDecorator.forBoolean(RuleType.ProductCache);
      await decorator(products, context);
      mockRuleDao.verify();

      assert.equal(_.get(_.first(products), actionName), true);
    });
    it('blacklist value overrides whitelist value', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(context, RuleType.ProductCache)
        .resolves(rules);
      mockRuleDao
        .expects('aggregateClauses')
        .resolves([{ meta: { year: 'year1' } }]); // whitelist
      mockRuleDao
        .expects('aggregateClauses')
        .resolves([{ meta: { year: 'year1' } }]); // blacklist

      const actionName = (ruleDecorator as any).booleanActionName(
        RuleDao.RULE_TYPE_META[RuleType.ProductCache],
      );
      const decorator = ruleDecorator.forBoolean(RuleType.ProductCache);
      await decorator(products, context);
      mockRuleDao.verify();

      assert.equal(_.get(_.first(products), actionName), false);
    });
  });
  describe('getDecoratorFields', () => {
    it('returns fields that have been added to products by decorators', async () => {
      const decoratorFields = ruleDecorator.getDecoratorFields();
      expect(decoratorFields).to.deep.equal(['cache', 'available']);
    });
  });
});
