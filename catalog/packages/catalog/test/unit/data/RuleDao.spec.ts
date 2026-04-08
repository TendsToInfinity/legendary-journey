import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Rule, RuleType } from '../../../src/controllers/models/Rule';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('RuleDao - Unit', () => {
  let ruleDao: RuleDao;
  let mockPg: sinon.SinonMock;
  let mockClauseConverter: sinon.SinonMock;
  let mockProductTypeDao: sinon.SinonMock;

  function toRow(rule: Rule) {
    return {
      ...(rule.customerId && { customerId: rule.customerId }),
      ...(rule.siteId && { siteId: rule.siteId }),
      ...(rule.productId && { productId: rule.productId }),
      productTypeId: rule.productTypeId,
      type: RuleType.ProductAvailability,
      name: rule.name,
      ...(rule.action && { action: rule.action }),
      enabled: rule.enabled,
      clauses: {},
    };
  }

  beforeEach(() => {
    ruleDao = new RuleDao();
    mockPg = MockUtils.inject(ruleDao, '_pg', Postgres);
    mockClauseConverter = MockUtils.inject(ruleDao, 'clauseConverter');
    // tslint:disable-next-line
    mockProductTypeDao = sinon.mock((ruleDao as any).productTypeDao);
  });

  afterEach(() => {
    sinon.restore();
  });

  function verify() {
    mockPg.verify();
    mockProductTypeDao.verify();
    mockClauseConverter.verify();
  }

  describe('findSetsByContext', () => {
    it('should return all rule sets', async () => {
      const numRuleSets = _.size(RuleType);
      const rules = [
        ModelFactory.rule({ customerId: 'customerId' }),
        ModelFactory.rule({ customerId: 'customerId' }),
      ];
      const rows = rules.map(toRow);
      for (const ruleType of _.values(RuleType)) {
        mockPg
          .expects('query')
          .withArgs(sinon.match.string, ['customerId', 'siteId', ruleType])
          .resolves(ModelFactory.queryResult({ rows }));
      }
      mockProductTypeDao.expects('findOneOrFail').atLeast(1).resolves({});
      mockClauseConverter
        .expects('convertFrom')
        .exactly(numRuleSets * rules.length)
        .returns({});
      const ruleSet = await ruleDao.findSetsByContext({
        customerId: 'customerId',
        siteId: 'siteId',
      });
      const expectedRuleSet = _.fromPairs(
        _.values(RuleType).map((ruleType) => [ruleType, rules]),
      );
      expect(ruleSet).to.deep.equal(expectedRuleSet);
      verify();
    });
    it('should return globals rules', async () => {
      const numRuleSets = _.size(RuleType);
      const rules = [ModelFactory.rule(), ModelFactory.rule()];
      const rows = rules.map(toRow);
      for (const ruleType of _.values(RuleType)) {
        mockPg
          .expects('query')
          .withArgs(sinon.match.string, ['customerId', 'siteId', ruleType])
          .resolves(ModelFactory.queryResult({ rows }));
      }
      mockProductTypeDao.expects('findOneOrFail').atLeast(1).resolves({});
      mockClauseConverter
        .expects('convertFrom')
        .exactly(numRuleSets * rules.length)
        .returns({});
      const ruleSet = await ruleDao.findSetsByContext({
        customerId: 'customerId',
        siteId: 'siteId',
      });
      const expectedRuleSet = _.fromPairs(
        _.values(RuleType).map((ruleType) => [ruleType, rules]),
      );
      expect(ruleSet).to.deep.equal(expectedRuleSet);
      verify();
    });
  });
  describe('findSetByContext', () => {
    it('should return a rule set', async () => {
      const rules = [
        ModelFactory.rule({ customerId: 'customerId' }),
        ModelFactory.rule({ customerId: 'customerId' }),
      ];
      const rows = rules.map(toRow);
      mockPg
        .expects('query')
        .withArgs(sinon.match.string, [
          'customerId',
          'siteId',
          RuleType.ProductPrice,
        ])
        .resolves(ModelFactory.queryResult({ rows }));
      mockProductTypeDao.expects('findOneOrFail').atLeast(1).resolves({});
      mockClauseConverter.expects('convertFrom').twice().returns({});
      const ruleSet = await ruleDao.findSetByContext(
        { customerId: 'customerId', siteId: 'siteId' },
        RuleType.ProductPrice,
      );
      expect(ruleSet).to.deep.equal(rules);
      verify();
    });
    it('should use empty strings if no context', async () => {
      const rules = [ModelFactory.rule(), ModelFactory.rule()];
      const rows = rules.map(toRow);
      mockPg
        .expects('query')
        .withArgs(sinon.match.string, ['', '', RuleType.ProductPrice])
        .resolves(ModelFactory.queryResult({ rows }));
      mockProductTypeDao.expects('findOneOrFail').atLeast(1).resolves({});
      mockClauseConverter.expects('convertFrom').twice().returns({});
      const ruleSet = await ruleDao.findSetByContext(
        undefined,
        RuleType.ProductPrice,
      );
      expect(ruleSet).to.deep.equal(rules);
      verify();
    });
  });
  describe('aggregateClauses', () => {
    it('should aggregate clauses for rules', async () => {
      const productTypeId = 'movie';
      const expectedResult = [{ productTypeId, meta: { name: 'Frozen' } }];
      mockPg
        .expects('query')
        .withArgs(
          `SELECT product_type_id, clauses FROM rule WHERE rule_id = ANY($1)`,
          [[1, 2, 3]],
        )
        .resolves({ rows: [{ productTypeId, clauses: expectedResult }] });
      expect(await ruleDao.aggregateClauses([1, 2, 3])).to.deep.equal(
        expectedResult,
      );
      verify();
    });
    it('should return productTypeId if no clauses', async () => {
      const productTypeId = 'movie';
      const expectedResult = [{ productTypeId }];
      mockPg
        .expects('query')
        .withArgs(
          `SELECT product_type_id, clauses FROM rule WHERE rule_id = ANY($1)`,
          [[1, 2, 3]],
        )
        .resolves({ rows: [{ productTypeId, clauses: {} }] });
      expect(await ruleDao.aggregateClauses([1, 2, 3])).to.deep.equal(
        expectedResult,
      );
      verify();
    });
    it('should return empty array if no result is returned', async () => {
      mockPg
        .expects('query')
        .withArgs(
          `SELECT product_type_id, clauses FROM rule WHERE rule_id = ANY($1)`,
          [[1, 2, 3]],
        )
        .resolves({ rows: [] });
      expect(await ruleDao.aggregateClauses([1, 2, 3])).to.deep.equal([]);
      verify();
    });
  });
  describe('convertTo', () => {
    it('should convert', async () => {
      const rule = ModelFactory.rule({
        customerId: 'customerId',
        productTypeId: 'movie',
        clauses: { pls: ['work', 'plspls'] },
        type: RuleType.ProductAvailability,
        action: { allowed: false },
      });
      const jsonSchema = ModelFactory.testSchema();
      const convertedClauses = [{ pls: 'work' }, { pls: 'plspls' }];
      mockProductTypeDao
        .expects('findOneOrFail')
        .withArgs('movie')
        .resolves({ jsonSchema });
      mockClauseConverter
        .expects('convertTo')
        .withArgs(rule.clauses, jsonSchema)
        .returns(convertedClauses);
      const converted = await ruleDao.convertTo(rule);
      expect(converted).to.deep.equal({
        customer_id: rule.customerId,
        product_type_id: rule.productTypeId,
        type: RuleType.ProductAvailability,
        name: rule.name,
        action: rule.action,
        enabled: rule.enabled,
        clauses: convertedClauses,
      });
      verify();
    });
    it('should blow up if converting clauses without a productTypeId', async () => {
      const rule = {
        customerId: 'customerId',
        clauses: { pls: ['work', 'plspls'] },
      } as any as Rule;
      mockProductTypeDao.expects('findOneOrFail').never();
      mockClauseConverter.expects('convertTo').never();
      try {
        await ruleDao.convertTo(rule);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name, err);
        expect(err.message).to.equal(
          'Cannot convert clauses without a productTypeId.',
        );
      }
      verify();
    });
    it('should support converting without productTypeId or clauses', async () => {
      const rule = { customerId: 'I-003320' } as any as Rule;
      mockProductTypeDao.expects('findOneOrFail').never();
      mockClauseConverter.expects('convertTo').never();
      const converted = await ruleDao.convertTo(rule);
      expect(converted).to.deep.equal({
        customer_id: rule.customerId,
      });
      verify();
    });
  });
  describe('convertFrom', () => {
    it('should convert', async () => {
      const rule = ModelFactory.rule({
        customerId: 'customerId',
        siteId: '99341',
        productTypeId: 'movie',
        productId: 654654,
        clauses: { pls: ['work', 'plspls'] },
        type: RuleType.ProductAvailability,
      });
      const row = {
        ...toRow(rule),
        clauses: { pls: ['work', 'plspls'] },
      };

      const jsonSchema = ModelFactory.testSchema();
      const convertedClauses = rule.clauses;
      mockProductTypeDao
        .expects('findOneOrFail')
        .withArgs('movie')
        .resolves({ jsonSchema });
      mockClauseConverter
        .expects('convertFrom')
        .withArgs(row.clauses, jsonSchema)
        .returns(convertedClauses);
      const converted = await ruleDao.convertFrom(row);
      expect(converted).to.deep.equal(rule);
      verify();
    });
    it('should not return null siteId or customerId', async () => {
      const rule = ModelFactory.rule({
        productTypeId: 'movie',
        clauses: { pls: ['work', 'plspls'] },
        type: RuleType.ProductAvailability,
      });
      const row = {
        ...toRow(rule),
        clauses: { pls: ['work', 'plspls'] },
      };

      const jsonSchema = ModelFactory.testSchema();
      const convertedClauses = rule.clauses;
      mockProductTypeDao
        .expects('findOneOrFail')
        .withArgs('movie')
        .resolves({ jsonSchema });
      mockClauseConverter
        .expects('convertFrom')
        .withArgs(row.clauses, jsonSchema)
        .returns(convertedClauses);
      const converted = await ruleDao.convertFrom(row);
      expect(converted).to.deep.equal(rule);
      verify();
    });
  });

  describe('findSubscriptionRulesByProductType', () => {
    const rule = ModelFactory.productSubscriptionAvailabilityRule({
      productId: 1,
      productTypeId: 'game',
      ruleId: 1,
    });

    it('should find rule with subscription product id matching the given product type', async () => {
      const rows = [rule];

      const spyQuery = sinon.stub(ruleDao as any, 'query').resolves({ rows });

      const spyConvertFrom = sinon.stub(ruleDao as any, 'convertFrom');

      spyConvertFrom.onCall(0).resolves(rule);

      const actualResult = await ruleDao.find({
        by: {
          productTypeId: 'game',
        },
        customClauses: [{ clause: `product_id IS NOT NULL`, params: [] }],
        pageSize: Number.MAX_SAFE_INTEGER,
      });

      expect(spyQuery.calledOnce).to.be.equal(true);
      expect(spyConvertFrom.calledOnce).to.be.equal(true);
      expect(actualResult.length).to.be.equal(1);
      expect(actualResult).to.deep.equal([rule]);
    });

    it('should handle findSubscriptionRulesByProductType failure', async () => {
      try {
        const spyQuery = sinon
          .stub(ruleDao as any, 'query')
          .rejects(new Error('UNKNOWN_EXCEPTION'));

        await ruleDao.find({
          by: {
            productTypeId: 'game',
          },
          customClauses: [{ clause: `product_id IS NOT NULL`, params: [] }],
          pageSize: Number.MAX_SAFE_INTEGER,
        });

        spyQuery.reset();
        assert.fail();
      } catch (err) {
        assert.equal(err.message, 'UNKNOWN_EXCEPTION');
      }
    });
  });
});
