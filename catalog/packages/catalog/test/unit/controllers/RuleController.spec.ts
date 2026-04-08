import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert, expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { RuleController } from '../../../src/controllers/RuleController';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ModelFactory } from '../../utils/ModelFactory';

describe('RuleController - Unit', () => {
  let controller: RuleController;
  let mockRuleManager: sinon.SinonMock;

  beforeEach(() => {
    controller = new RuleController();
    mockRuleManager = sinon.mock((controller as any).ruleManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findRules', () => {
    it('should provide defaults and call RuleManager.find', async () => {
      mockRuleManager.expects('findByQueryString').withArgs({});
      await controller.findRules({ query: {} } as Request);
      sinon.verify();
    });
  });

  describe('findRule', () => {
    it('should call RuleManager.findOneOrFail', async () => {
      mockRuleManager.expects('findOneOrFail').withArgs(1);
      await controller.findRule('1');
      sinon.verify();
    });
  });

  describe('restrictMusicRules', () => {
    it('should not allow any create/update/delete of music sub/avail rules for corpJwt', async () => {
      let count = 0;
      for (const productTypeId of ['track', 'album', 'artist']) {
        const partialRule = { productTypeId, action: { available: true } };
        for (const type of [
          RuleType.ProductAvailability,
          RuleType.ProductSubscriptionAvailability,
        ]) {
          const rule =
            type === RuleType.ProductAvailability
              ? ModelFactory.productAvailabilityRule({
                  ruleId: 123 + count,
                  ...partialRule,
                })
              : ModelFactory.productSubscriptionAvailabilityRule({
                  ruleId: 123 + count,
                  productId: 777,
                  ...partialRule,
                });
          count++;
          try {
            await controller.createRule(rule, {
              corpJwt: SecurityFactory.corpJwt(),
            });
            expect.fail();
          } catch (error) {
            expect(error.code).to.equal(400);
            expect(error.name).to.equal('InvalidData');
            expect(error.message).to.equal(
              'Music availability and subscription rules cannot be created at this time',
            );
          }
          try {
            await controller.updateRule(rule.ruleId.toString(), rule, {
              corpJwt: SecurityFactory.corpJwt(),
            });
            expect.fail();
          } catch (error) {
            expect(error.code).to.equal(400);
            expect(error.name).to.equal('InvalidData');
            expect(error.message).to.equal(
              'Music availability and subscription rules cannot be created at this time',
            );
          }
        }
      }
    });
    it('should not allow deleting music sub/avail rules for any corpJwt', async () => {
      let count = 0;
      for (const productTypeId of ['track', 'album', 'artist']) {
        const partialRule = { productTypeId, action: { available: true } };
        for (const type of [
          RuleType.ProductAvailability,
          RuleType.ProductSubscriptionAvailability,
        ]) {
          const rule =
            type === RuleType.ProductAvailability
              ? ModelFactory.productAvailabilityRule({
                  ruleId: 123 + count,
                  ...partialRule,
                })
              : ModelFactory.productSubscriptionAvailabilityRule({
                  ruleId: 123 + count,
                  productId: 777,
                  ...partialRule,
                });
          count++;
          mockRuleManager
            .expects('findOneOrFail')
            .withExactArgs(rule.ruleId)
            .resolves(rule);
          try {
            await controller.deleteRule(rule.ruleId.toString(), {
              corpJwt: SecurityFactory.corpJwt(),
            });
            expect.fail();
          } catch (error) {
            expect(error.code).to.equal(400);
            expect(error.name).to.equal('InvalidData');
            expect(error.message).to.equal(
              'Music availability and subscription rules cannot be created at this time',
            );
          }
        }
      }
      mockRuleManager.verify();
    });
    it('should not allow deleting music sub/avail rules for any apiKey', async () => {
      let count = 0;
      for (const productTypeId of ['track', 'album', 'artist']) {
        const partialRule = { productTypeId, action: { available: true } };
        for (const type of [
          RuleType.ProductAvailability,
          RuleType.ProductSubscriptionAvailability,
        ]) {
          const rule =
            type === RuleType.ProductAvailability
              ? ModelFactory.productAvailabilityRule({
                  ruleId: 123 + count,
                  ...partialRule,
                })
              : ModelFactory.productSubscriptionAvailabilityRule({
                  ruleId: 123 + count,
                  productId: 777,
                  ...partialRule,
                });
          count++;
          mockRuleManager
            .expects('findOneOrFail')
            .withExactArgs(rule.ruleId)
            .resolves(rule);
          try {
            await controller.deleteRule(rule.ruleId.toString(), {
              apiKey: 'apiKey',
            });
            expect.fail();
          } catch (error) {
            expect(error.code).to.equal(400);
            expect(error.name).to.equal('InvalidData');
            expect(error.message).to.equal(
              'Music availability and subscription rules cannot be created at this time',
            );
          }
        }
      }
      mockRuleManager.verify();
    });
    it('should allow create/update music sub/avail rules for apiKey', async () => {
      const context = { apiKey: 'apiKey' };
      const count = 0;
      for (const productTypeId of ['track', 'album', 'artist']) {
        const availabilityRule = ModelFactory.productAvailabilityRule({
          ruleId: 123 + count,
          productTypeId,
          action: { available: true },
        });
        const subscriptionRule =
          ModelFactory.productSubscriptionAvailabilityRule({
            ruleId: 123 + count,
            productId: 777,
            productTypeId,
            action: { available: true },
          });
        mockRuleManager
          .expects('createRule')
          .withExactArgs(availabilityRule, context)
          .resolves();
        mockRuleManager
          .expects('createRule')
          .withExactArgs(subscriptionRule, context)
          .resolves();
        mockRuleManager
          .expects('updateRule')
          .withExactArgs(availabilityRule, context)
          .resolves();
        mockRuleManager
          .expects('updateRule')
          .withExactArgs(subscriptionRule, context)
          .resolves();
        await controller.createRule(availabilityRule, context);
        await controller.createRule(subscriptionRule, context);
        await controller.updateRule(
          availabilityRule.ruleId.toString(),
          availabilityRule,
          context,
        );
        await controller.updateRule(
          subscriptionRule.ruleId.toString(),
          subscriptionRule,
          context,
        );
      }
      mockRuleManager.verify();
    });
  });

  describe('createRule', () => {
    it('should call RuleManager.createRule', async () => {
      const rule = ModelFactory.rule();
      const corpJwt = SecurityFactory.corpJwt();
      const newRuleId = 1;

      mockRuleManager
        .expects('createRule')
        .withArgs(rule, { corpJwt })
        .resolves(newRuleId);

      const result = await controller.createRule(rule, { corpJwt });

      expect(result.ruleId).to.equal(newRuleId);

      sinon.verify();
    });
  });

  describe('updateRule', () => {
    const rule = { ...ModelFactory.rule(), ruleId: 1 };
    const corpJwt = SecurityFactory.corpJwt();

    it('should call RuleManager.updateRule', async () => {
      mockRuleManager.expects('updateRule').withArgs(rule, { corpJwt });

      await controller.updateRule(rule.ruleId.toString(), rule, { corpJwt });

      sinon.verify();
    });

    it('should get a 400 for mismatched ruleIds', async () => {
      try {
        await controller.updateRule('123', rule, { corpJwt });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }

      sinon.verify();
    });
  });

  describe('deleteRule', () => {
    it('should call RuleManager.deleteRule for a rule', async () => {
      const corpJwt = SecurityFactory.corpJwt();

      mockRuleManager
        .expects('findOneOrFail')
        .withExactArgs(1)
        .resolves(ModelFactory.rule({ productTypeId: 'car' }));
      mockRuleManager.expects('deleteRule').withArgs(1, { corpJwt });

      await controller.deleteRule('1', { corpJwt });

      sinon.verify();
    });
  });
});
