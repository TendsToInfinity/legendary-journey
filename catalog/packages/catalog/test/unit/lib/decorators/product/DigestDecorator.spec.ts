import { expect } from 'chai';
import * as sinon from 'sinon';
import { DigestDecorator } from '../../../../../src/lib/decorators/product/DigestDecorator';
import { ModelFactory } from '../../../../utils/ModelFactory';

describe('DigestDecorator - Unit', () => {
  const sandbox = sinon.createSandbox();
  let digestDecorator: DigestDecorator;

  beforeEach(() => {
    digestDecorator = new DigestDecorator();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('decorator', () => {
    it('removes digest if context enforce = true', async () => {
      const products = [
        ModelFactory.product({ digest: ModelFactory.digest() }),
      ];
      const context = {
        customerId: 'customerId',
        siteId: 'siteId',
        enforce: true,
      };

      await digestDecorator.decorator(products, context);
      expect(products[0].digest).to.be.undefined;
    });
    it('leaves digest if context enforce = false', async () => {
      const digest = ModelFactory.digest();
      const products = [ModelFactory.product({ digest })];
      const context = {
        customerId: 'customerId',
        siteId: 'siteId',
        enforce: false,
      };

      await digestDecorator.decorator(products, context);
      expect(products[0].digest).to.not.be.undefined;
      expect(products[0].digest).to.deep.equal(digest);
    });
    it('adds subscriptionIds to products if on digest', async () => {
      const subscriptionIds = [11, 12, 13];
      const products = [
        ModelFactory.product({
          digest: ModelFactory.digest({
            subscriptionProductIds: subscriptionIds,
          }),
        }),
      ];
      const context = {
        customerId: 'customerId',
        siteId: 'siteId',
        enforce: true,
      };

      await digestDecorator.decorator(products, context);
      expect(products[0].subscriptionIds).to.deep.equal(subscriptionIds);
    });
  });
  describe('getDecoratorFields', () => {
    it('returns fields that have been added to products by decorators', async () => {
      const decoratorFields = digestDecorator.getDecoratorFields();
      expect(decoratorFields).to.deep.equal(['digest', 'subscriptionIds']);
    });
  });
});
