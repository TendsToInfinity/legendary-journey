import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { RuleType } from '../../../src/controllers/models/Rule';
import { RuleValidator } from '../../../src/lib/RuleValidator';
import { ModelFactory } from '../../utils/ModelFactory';

describe('RuleValidator', () => {
  let ruleValidator: RuleValidator;
  let mockRuleDao: sinon.SinonMock;
  let mockInterfaceValidator: sinon.SinonMock;

  beforeEach(() => {
    ruleValidator = new RuleValidator();
    mockRuleDao = sinon.mock((ruleValidator as any).ruleDao);
    mockInterfaceValidator = sinon.mock(
      (ruleValidator as any).interfaceValidator,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('validate', () => {
    it(`should validate ${RuleType.ProductTypeAvailability} rules`, async () => {
      const rule = ModelFactory.rule({
        type: RuleType.ProductTypeAvailability,
      });
      mockInterfaceValidator
        .expects('validateModel')
        .withArgs(rule, 'ProductTypeAvailabilityRule')
        .resolves(true);
      mockRuleDao.expects('exists').resolves(false);

      expect(await ruleValidator.validate(rule)).to.equal(rule);

      mockInterfaceValidator.verify();
      mockRuleDao.verify();
    });
    it(`should not check for uniqueness for regular rule types`, async () => {
      const rule = ModelFactory.rule({ type: RuleType.ProductPrice });
      mockInterfaceValidator
        .expects('validateModel')
        .withArgs(rule, 'ProductPriceRule')
        .resolves(true);
      mockRuleDao.expects('exists').never();

      expect(await ruleValidator.validate(rule)).to.equal(rule);

      mockInterfaceValidator.verify();
      mockRuleDao.verify();
    });
    it(`should fail validation if interface validation fails`, async () => {
      const rule = ModelFactory.rule({
        type: RuleType.ProductTypeAvailability,
        clauses: { this: 'is not allowed' },
      });
      mockInterfaceValidator
        .expects('validateModel')
        .resolves([
          { property: 'clauses', message: 'invalid', extra: 'ignore me' },
        ]);
      mockRuleDao.expects('exists').atLeast(0).resolves(false);

      try {
        await ruleValidator.validate(rule);
        expect.fail();
      } catch (err) {
        expect(err.message).to.equal(
          'Rule is invalid [{"property":"clauses","message":"invalid"}]',
        ); // I'm just here so I don't get fined
        expect(err.name).to.equal(Exception.InvalidData.name, err);
        expect(err.errors).to.deep.equal([
          { property: 'clauses', message: 'invalid' },
        ]);
      }

      mockInterfaceValidator.verify();
      mockRuleDao.verify();
    });
    it(`should fail validation if creating duplicate ${RuleType.ProductTypeAvailability} rule in site context`, async () => {
      const rule = ModelFactory.rule({
        type: RuleType.ProductTypeAvailability,
        customerId: '1',
        siteId: '2',
        productTypeId: '3',
      });
      mockInterfaceValidator.expects('validateModel').resolves(true);
      mockRuleDao
        .expects('exists')
        .withArgs({
          by: {
            customerId: '1',
            siteId: '2',
            productTypeId: '3',
            type: RuleType.ProductTypeAvailability,
          },
        })
        .resolves(true);

      try {
        await ruleValidator.validate(rule);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.Conflict.name, err);
        expect(err.errors).to.deep.equal([
          `Cannot create duplicate rule of type='${RuleType.ProductTypeAvailability}' for ` +
            `{ siteId: '2', customerId: '1', productTypeId: '3' }`,
        ]);
      }

      mockInterfaceValidator.verify();
      mockRuleDao.verify();
    });
    it(`should fail validation if creating duplicate ${RuleType.ProductTypeAvailability} rule in customer context`, async () => {
      const rule = ModelFactory.rule({
        type: RuleType.ProductTypeAvailability,
        customerId: '1',
        productTypeId: '3',
      });
      mockInterfaceValidator.expects('validateModel').resolves(true);
      mockRuleDao
        .expects('exists')
        .withArgs({
          by: {
            customerId: '1',
            siteId: null,
            productTypeId: '3',
            type: RuleType.ProductTypeAvailability,
          },
        })
        .resolves(true);

      try {
        await ruleValidator.validate(rule);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.Conflict.name, err);
        expect(err.errors).to.deep.equal([
          `Cannot create duplicate rule of type='${RuleType.ProductTypeAvailability}' for ` +
            `{ siteId: null, customerId: '1', productTypeId: '3' }`,
        ]);
      }

      mockInterfaceValidator.verify();
      mockRuleDao.verify();
    });
    it(`should fail validation if siteId exists without customerId`, async () => {
      const rule = ModelFactory.rule({
        type: RuleType.ProductTypeAvailability,
        siteId: 'Why am I here',
      });
      mockInterfaceValidator
        .expects('validateModel')
        .withArgs(rule, 'ProductTypeAvailabilityRule')
        .resolves(true);

      try {
        await ruleValidator.validate(rule);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InvalidData.name, err);
        expect(err.message).to.deep.equal(
          'Rule is invalid, siteId defined without customerId',
        );
      }

      mockInterfaceValidator.verify();
      mockRuleDao.verify();
    });
  });
});
