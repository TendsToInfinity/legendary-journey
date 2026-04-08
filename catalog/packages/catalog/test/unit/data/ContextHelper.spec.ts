import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Fee } from '../../../src/controllers/models/Fee';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ContextHelper } from '../../../src/data/PGCatalog/ContextHelper';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ContextHelper - Unit', () => {
  const sandbox = sinon.createSandbox();
  let contextHelper: ContextHelper<Fee>;
  let mockPg: sinon.SinonMock;

  beforeEach(() => {
    contextHelper = new ContextHelper<Fee>();
    _.set(contextHelper, '_pg', { query: () => {} });
    mockPg = sandbox.mock((contextHelper as any).pg);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('constructs the query according to the model', async () => {
    const fee = ModelFactory.fee();

    mockPg.expects('query').resolves(ModelFactory.queryResult({ rows: [fee] }));

    const fees = await contextHelper.findByContext({}, undefined);

    expect(fees[0]).to.deep.equal(fee);
    expect(fees).to.have.length(1);
  });

  describe('findByContextWithJsonClauses', () => {
    it('should return fees with json clauses', async () => {
      const feeId = 1;
      const fee = ModelFactory.fee({
        feeId: feeId,
        clauses: { meta: { name: 'Test' } },
        customerId: 'customerId',
        siteId: 'siteId',
      });

      // Queries without enforce explicitly specified as false should enforced enabled
      const query = `SELECT * FROM context_helper
                  WHERE (customer_id = $1 OR customer_id IS NULL)
                  AND (site_id = $2 OR site_id IS NULL)
                  AND ($3::text[] IS NULL OR product_type_id = ANY($3::text[])) AND enabled`;

      mockPg
        .expects('query')
        .withArgs(query, ['customerId', 'siteId', undefined])
        .resolves({ rows: [toRow(fee)] });
      const fees = await contextHelper.findByContextWithJsonClauses({
        customerId: 'customerId',
        siteId: 'siteId',
      });
      expect(fees[0]).to.deep.equal(fee);
    });
    it('should return fees with json clauses without context', async () => {
      const feeId = 1;
      const fee = ModelFactory.fee({
        feeId: feeId,
        clauses: { meta: { name: 'Test' } },
      });
      mockPg
        .expects('query')
        .withArgs(sinon.match.string, ['', '', undefined])
        .resolves({ rows: [toRow(fee)] });
      const fees = await contextHelper.findByContextWithJsonClauses();
      expect(fees[0]).to.deep.equal(fee);
    });

    it('should return disabled fees if context enforce false', async () => {
      const feeId = 1;
      const fee = ModelFactory.fee({
        feeId: feeId,
        clauses: { meta: { name: 'Test' } },
        enabled: false,
      });

      // Verify the query does not contain the AND enabled check
      const query = `SELECT * FROM context_helper
                  WHERE (customer_id = $1 OR customer_id IS NULL)
                  AND (site_id = $2 OR site_id IS NULL)
                  AND ($3::text[] IS NULL OR product_type_id = ANY($3::text[]))`;

      mockPg
        .expects('query')
        .withArgs(query, ['customerId', 'siteId', undefined])
        .resolves({ rows: [toRow(fee)] });
      const fees = await contextHelper.findByContextWithJsonClauses({
        customerId: 'customerId',
        siteId: 'siteId',
        enforce: false,
      });

      expect(fees[0]).to.deep.equal(fee);
    });
    it('should return filtered by ruleTypes', async () => {
      const feeId = 1;
      const fee = ModelFactory.fee({
        feeId: feeId,
        clauses: { meta: { name: 'Test' } },
      });
      const query = `SELECT * FROM context_helper
                  WHERE (customer_id = $1 OR customer_id IS NULL)
                  AND (site_id = $2 OR site_id IS NULL)
                  AND ($3::text[] IS NULL OR product_type_id = ANY($3::text[])) AND enabled AND type = ANY($4::text[])`;

      mockPg
        .expects('query')
        .withArgs(query, [
          '',
          '',
          undefined,
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        ])
        .resolves({ rows: [toRow(fee)] });
      const fees = await contextHelper.findByContextWithJsonClauses(
        undefined,
        undefined,
        [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
      );
      expect(fees[0]).to.deep.equal(fee);
    });
    it('should return filtered by productTypeIds', async () => {
      const feeId = 1;
      const fee = ModelFactory.fee({
        feeId: feeId,
        clauses: { meta: { name: 'Test' } },
      });
      const query = `SELECT * FROM context_helper
                  WHERE (customer_id = $1 OR customer_id IS NULL)
                  AND (site_id = $2 OR site_id IS NULL)
                  AND ($3::text[] IS NULL OR product_type_id = ANY($3::text[])) AND enabled AND type = ANY($4::text[])`;

      mockPg
        .expects('query')
        .withArgs(query, [
          '',
          '',
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        ])
        .resolves({ rows: [toRow(fee)] });
      const fees = await contextHelper.findByContextWithJsonClauses(
        undefined,
        ['movie'],
        [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
      );
      expect(fees[0]).to.deep.equal(fee);
    });
  });

  function toRow(fee: Fee) {
    return {
      ...(fee.customerId && { customerId: fee.customerId }),
      ...(fee.siteId && { siteId: fee.siteId }),
      ...(fee.amount && { amount: fee.amount }),
      ...(fee.feeId && { feeId: fee.feeId }),
      percent: fee.percent,
      productTypeId: fee.productTypeId,
      name: fee.name,
      enabled: fee.enabled,
      clauses: fee.clauses,
    };
  }
});
