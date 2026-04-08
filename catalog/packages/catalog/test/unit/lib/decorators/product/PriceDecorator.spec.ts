import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import {
  PriceDetailType,
  Product,
  ProductTypeIds,
} from '../../../../../src/controllers/models/Product';
import { RuleType } from '../../../../../src/controllers/models/Rule';
import { PriceDecorator } from '../../../../../src/lib/decorators/product/PriceDecorator';
import { ModelFactory } from '../../../../utils/ModelFactory';

describe('PriceDecorator - Unit', () => {
  let priceDecorator: PriceDecorator;
  let mockFeeDao: sinon.SinonMock;
  let mockEligibility: sinon.SinonMock;
  let mockDigestManager: sinon.SinonMock;
  let mockContextConfigManager: sinon.SinonMock;
  let mockConfig: sinon.SinonMock;

  beforeEach(() => {
    priceDecorator = new PriceDecorator();
    mockFeeDao = sinon.mock((priceDecorator as any).feeDao);
    mockEligibility = sinon.mock((priceDecorator as any).eligibilityManager);
    mockDigestManager = sinon.mock((priceDecorator as any).digestManager);
    mockContextConfigManager = sinon.mock(
      (priceDecorator as any).contextConfigManager,
    );
    mockConfig = sinon.mock((priceDecorator as any).config);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('purchaseOptions', () => {
    beforeEach(() => {
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockContextConfigManager.expects('resolveConfigs').resolves({
        config: {
          disablePurchaseType: { purchase: [], rental: [], subscription: [] },
        },
      });
    });

    it('properly calculates percentage and amount fees, adds subscription purchase option', async () => {
      const rules = [ModelFactory.rule()];
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
        ModelFactory.product({
          productId: 120012,
          purchaseTypes: ['purchase'],
          meta: {
            basePrice: { rental: 5.0 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: '50 cent',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: '50 "per" cents',
          customerId: 'customerId',
        }),
      ];

      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves(rules);
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs(rules, products[0])
        .returns(ModelFactory.digest({ subscriptionProductIds: [] }));
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs(rules, products[1])
        .returns(ModelFactory.digest({ subscriptionProductIds: [11] }));
      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();
      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 16.82,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: '50 cent', type: PriceDetailType.Fee, amount: 0.5 },
            { name: '50 "per" cents', type: PriceDetailType.Fee, amount: 5.44 },
          ],
        },
      ]);
      assert.deepEqual(actualResults.data[1].purchaseOptions[1], {
        type: 'subscription',
        totalPrice: 0,
        priceDetails: [
          {
            name: 'Price',
            amount: 0,
            type: PriceDetailType.Price,
          },
        ],
      });
    });
    it('discards fees that are not for the correct product type', async () => {
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          productTypeId: 'tvShow',
          amount: 0.5,
          percent: false,
          name: '50 cent',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: '50 cent',
          customerId: 'customerId',
        }),
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 11.38,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: '50 cent', type: PriceDetailType.Fee, amount: 0.5 },
          ],
        },
      ]);
    });
    it('respects price rule overrides', async () => {
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88, purchase: 40.5 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: '50 cent',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: '50 "per" cents',
          customerId: 'customerId',
        }),
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([{}]);
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs([{}], products[0])
        .returns({});
      mockDigestManager
        .expects('getEffectivePrice')
        .withExactArgs({}, {})
        .returns({ rental: 5.77 });
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(
        _.sortBy(actualResults.data[0].purchaseOptions, 'type'),
        [
          {
            totalPrice: 61.25,
            type: 'purchase',
            priceDetails: [
              { name: 'Price', type: PriceDetailType.Price, amount: 40.5 },
              { name: '50 cent', type: PriceDetailType.Fee, amount: 0.5 },
              {
                name: '50 "per" cents',
                type: PriceDetailType.Fee,
                amount: 20.25,
              },
            ],
          },
          {
            totalPrice: 9.16,
            type: 'rental',
            priceDetails: [
              { name: 'Price', type: PriceDetailType.Price, amount: 5.77 },
              { name: '50 cent', type: PriceDetailType.Fee, amount: 0.5 },
              {
                name: '50 "per" cents',
                type: PriceDetailType.Fee,
                amount: 2.89,
              },
            ],
          },
        ],
      );
    });
    it('no fees added for free products', async () => {
      mockDigestManager
        .expects('getDigestRulesByContext')
        .withExactArgs({})
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            effectivePrice: { rental: 0 },
            basePrice: { rental: 10.88 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: '50 cent',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: '50 "per" cents',
          customerId: 'customerId',
        }),
      ];

      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs([], products[0])
        .returns({});
      mockDigestManager
        .expects('getEffectivePrice')
        .withExactArgs({}, {})
        .returns({ rental: 0 });
      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      // total price should be 0 for free products (no taxes or fees)
      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 0,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 0 },
          ],
        },
      ]);
    });
    it('remove customer and global fees for zero dollar site fee', async () => {
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
            name: 'Test',
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({ amount: 1, percent: false, name: 'Global Fee' }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee With Clause',
          customerId: 'customerId',
          clauses: { meta: { name: 'Test' } },
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: 'Site Fee',
          customerId: 'customerId',
          siteId: 'siteId',
        }), // Should still apply
        ModelFactory.fee({
          amount: 1,
          percent: false,
          name: 'Site Fee with Clause',
          customerId: 'customerId',
          siteId: 'siteId',
        }), // Should still apply
        ModelFactory.fee({
          amount: 0,
          percent: false,
          name: 'No fee',
          customerId: 'customerId',
          siteId: 'siteId',
          clauses: { meta: { name: 'Test' } },
        }), // Zero fee
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 17.32,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: 'Site Fee', type: PriceDetailType.Fee, amount: 5.44 },
            {
              name: 'Site Fee with Clause',
              type: PriceDetailType.Fee,
              amount: 1,
            },
          ],
        },
      ]);
    });
    it('remove global fees for zero dollar customer fee', async () => {
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie', 'game'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
        ModelFactory.product({
          purchaseTypes: ['purchase'],
          productTypeId: 'game',
          meta: {
            basePrice: { purchase: 5.0 },
          } as any,
        }),
      ];

      const fees = [
        ModelFactory.fee({ amount: 1, percent: false, name: 'Global Fee' }),
        ModelFactory.fee({
          productTypeId: 'game',
          amount: 1,
          percent: false,
          name: 'Global Fee Game',
        }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee',
          customerId: 'customerId',
        }), // Should still apply
        ModelFactory.fee({
          productTypeId: 'game',
          amount: 3.0,
          percent: false,
          name: 'Customer Fee Game',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: 'Site Fee',
          customerId: 'customerId',
          siteId: 'siteId',
        }), // Should still apply
        ModelFactory.fee({
          productTypeId: 'game',
          amount: 25,
          percent: true,
          name: 'Site Fee Game',
          customerId: 'customerId',
          siteId: 'siteId',
        }),
        ModelFactory.fee({
          amount: 0,
          percent: false,
          name: 'No fee',
          customerId: 'customerId',
        }),
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 16.82,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: 'Customer Fee', type: PriceDetailType.Fee, amount: 0.5 },
            { name: 'Site Fee', type: PriceDetailType.Fee, amount: 5.44 },
          ],
        },
      ]);
      assert.deepEqual(actualResults.data[1].purchaseOptions, [
        {
          totalPrice: 10.25,
          type: 'purchase',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 5 },
            { name: 'Global Fee Game', type: PriceDetailType.Fee, amount: 1 },
            { name: 'Customer Fee Game', type: PriceDetailType.Fee, amount: 3 },
            { name: 'Site Fee Game', type: PriceDetailType.Fee, amount: 1.25 },
          ],
        },
      ]);
    });
    it('remove all fees for a global zero fee from that productTypeId', async () => {
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie', 'tvEpisode'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          productTypeId: 'movie',
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
        ModelFactory.product({
          purchaseTypes: ['rental'],
          productTypeId: 'tvEpisode',
          meta: {
            basePrice: { rental: 2.84 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          productTypeId: 'movie',
          amount: 1,
          percent: false,
          name: 'Global Fee',
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          amount: 0.5,
          percent: false,
          name: 'Customer Fee',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          amount: 50,
          percent: true,
          name: 'Site Fee',
          customerId: 'customerId',
          siteId: 'siteId',
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          amount: 0,
          percent: false,
          name: 'No fee',
        }),
        ModelFactory.fee({
          productTypeId: 'tvEpisode',
          amount: 1,
          percent: false,
          name: 'Global TV Fee',
        }),
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 10.88,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
          ],
        },
      ]);
      assert.deepEqual(actualResults.data[1].purchaseOptions, [
        {
          totalPrice: 3.84,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 2.84 },
            { amount: 1, name: 'Global TV Fee', type: 'fee' },
          ],
        },
      ]);
    });
    it('should handle a mess of zero and normal fees', async () => {
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({ amount: 1, percent: false, name: 'Global Fee' }),
        ModelFactory.fee({
          amount: 1,
          percent: false,
          name: 'Global Zero Fee',
        }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: 'Customer Fee Again',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 0,
          percent: false,
          name: 'Customer Zero Fee',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 2,
          percent: false,
          name: 'Site Fee',
          customerId: 'customerId',
          siteId: 'siteId',
        }),
        ModelFactory.fee({
          amount: 1,
          percent: false,
          name: 'Site Fee Again',
          customerId: 'customerId',
          siteId: 'siteId',
        }),
        ModelFactory.fee({
          amount: 0,
          percent: false,
          name: 'Site Zero Fee',
          customerId: 'customerId',
          siteId: 'siteId',
        }),
        ModelFactory.fee({
          amount: 0,
          percent: false,
          name: 'Site Zero Fee x2 Because why not',
          customerId: 'customerId',
          siteId: 'siteId',
        }),
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 13.88,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: 'Site Fee', type: PriceDetailType.Fee, amount: 2 },
            { name: 'Site Fee Again', type: PriceDetailType.Fee, amount: 1 },
          ],
        },
      ]);
    });
    it('should only apply fee if clauses match', async () => {
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves([]);
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
            name: 'Test',
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({ amount: 2, percent: false, name: 'Global Fee' }),
        ModelFactory.fee({
          amount: 1,
          percent: false,
          name: 'Test Fee Only',
          clauses: [{ meta: { name: 'Test' } }],
        }),
        ModelFactory.fee({
          amount: 4,
          percent: false,
          name: 'Clause does not match',
          clauses: [{ meta: { name: '🙃' } }],
        }),
      ];

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 13.88,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: 'Global Fee', type: PriceDetailType.Fee, amount: 2 },
            { name: 'Test Fee Only', type: PriceDetailType.Fee, amount: 1 },
          ],
        },
      ]);
    });
    it('purchaseOptions should have only subscription type when the product has availableForPurchase- false and regardless of the value for availableForSubscription', async () => {
      const rules = [ModelFactory.rule()];
      const products = [
        ModelFactory.product({
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
        ModelFactory.product({
          productId: 120012,
          purchaseTypes: ['rental'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
          source: {
            availableForPurchase: false,
            availableForSubscription: false,
          } as any,
        }),
        ModelFactory.product({
          productId: 120011,
          purchaseTypes: ['purchase'],
          meta: {
            basePrice: { rental: 5.0 },
          } as any,
          source: {
            availableForPurchase: false,
            availableForSubscription: true,
          } as any,
        }),
        ModelFactory.product({
          productId: 120013,
          productTypeId: 'apk',
          purchaseTypes: ['purchase'],
          meta: {
            basePrice: { rental: 10.88 },
          } as any,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          amount: 0.5,
          percent: false,
          name: '50 cent',
          customerId: 'customerId',
        }),
        ModelFactory.fee({
          amount: 50,
          percent: true,
          name: '50 "per" cents',
          customerId: 'customerId',
        }),
      ];
      mockDigestManager
        .expects('getRulesByProductType')
        .withExactArgs(
          {},
          ['movie', 'apk'],
          [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
        )
        .resolves(rules);
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs(rules, products[0])
        .returns(ModelFactory.digest({ subscriptionProductIds: [] }));
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs(rules, products[1])
        .returns(ModelFactory.digest({ subscriptionProductIds: [12] }));
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs(rules, products[2])
        .returns(ModelFactory.digest({ subscriptionProductIds: [11] }));
      mockDigestManager
        .expects('getProductDigest')
        .withExactArgs(rules, products[3])
        .returns(ModelFactory.digest({ subscriptionProductIds: [13] }));

      mockFeeDao.expects('findByContextWithJsonClauses').resolves(fees);
      await priceDecorator.decorator(products, {});
      const actualResults = {
        data: products,
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockFeeDao.verify();

      assert.deepEqual(actualResults.data[0].purchaseOptions, [
        {
          totalPrice: 16.82,
          type: 'rental',
          priceDetails: [
            { name: 'Price', type: PriceDetailType.Price, amount: 10.88 },
            { name: '50 cent', type: PriceDetailType.Fee, amount: 0.5 },
            { name: '50 "per" cents', type: PriceDetailType.Fee, amount: 5.44 },
          ],
        },
      ]);
      expect(actualResults.data[1].purchaseOptions.length).to.equal(1);
      assert.deepEqual(actualResults.data[1].purchaseOptions[0], {
        type: 'subscription',
        totalPrice: 0,
        priceDetails: [
          {
            name: 'Price',
            amount: 0,
            type: PriceDetailType.Price,
          },
        ],
      });

      expect(actualResults.data[2].purchaseOptions.length).to.equal(1);
      assert.deepEqual(actualResults.data[2].purchaseOptions[0], {
        type: 'subscription',
        totalPrice: 0,
        priceDetails: [
          {
            name: 'Price',
            amount: 0,
            type: PriceDetailType.Price,
          },
        ],
      });

      expect(actualResults.data[3].purchaseOptions.length).to.equal(2);
    });
  });

  describe('priceProducts', async () => {
    beforeEach(() => {
      mockDigestManager.expects('getRulesByProductType').resolves([]);
    });

    it('should have purchase options when not disableMediaPurchase', async () => {
      const feeContext = { temp: 'test' };
      const products = [
        ModelFactory.pricedProduct({
          productId: 123,
          purchaseTypes: ['rental'],
          meta: { basePrice: { rental: 1.0 } },
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockContextConfigManager.expects('resolveConfigs').never();
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(feeContext)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      await priceDecorator.decorator(products, feeContext as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.not.be.empty;
      mockEligibility.verify();
    });
    it('should have purchase options for non-media when disableMediaPurchase', async () => {
      const feeContext = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productId: 123,
          productTypeId: 'newsStand',
          purchaseTypes: ['rental'],
          meta: { basePrice: { rental: 1.0 } },
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockContextConfigManager.expects('resolveConfigs').never();
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(feeContext)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      await priceDecorator.decorator(products, feeContext as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.not.be.empty;
      mockEligibility.verify();
    });
    it('should not have purchase options when disableMediaPurchase', async () => {
      const feeContext = { temp: 'test' };
      const products = [
        ModelFactory.pricedProduct({
          productId: 123,
          purchaseTypes: ['rental'],
          meta: { basePrice: { rental: 1.0 } },
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .withExactArgs()
        .resolves(
          ModelFactory.defaultEligibility({ disableMediaPurchase: true }),
        );
      mockContextConfigManager.expects('resolveConfigs').resolves({
        config: {
          disablePurchaseType: { purchase: [], rental: [], subscription: [] },
        },
      });
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(feeContext)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      await priceDecorator.decorator(products, feeContext as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.be.empty;
      mockEligibility.verify();
    });
    it('should not have purchase option for digital purchase when disabled', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Game,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 1.0 } },
          fulfillmentType: 'digital',
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager.expects('resolveConfigs').resolves({
        config: { disablePurchaseType: { purchase: [ProductTypeIds.Game] } },
      });
      await priceDecorator.decorator(products, context as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.be.empty;
      mockEligibility.verify();
    });
    it('should not have purchase option for track if missing s3Path for local media', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Track,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 1.0 } },
          fulfillmentType: 'digital',
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager
        .expects('resolveConfigs')
        .resolves({ config: { disablePurchaseType: { purchase: [] } } });
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      await priceDecorator.decorator(products, context as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.be.empty;
      mockEligibility.verify();
    });
    it('should have purchase option for track if contains s3Path for local media', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Track,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 1.0 } },
          fulfillmentType: 'digital',
          source: { s3Path: 'test' },
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager
        .expects('resolveConfigs')
        .resolves({ config: { disablePurchaseType: { purchase: [] } } });
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      await priceDecorator.decorator(products, context as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.not.be.empty;
      mockEligibility.verify();
    });
    it('should not have purchase option for subscription if any track missing s3Path for local media', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Album,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 1.0 } },
          fulfillmentType: 'digital',
          childProducts: [
            ModelFactory.product({ productTypeId: ProductTypeIds.Track }),
          ],
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager
        .expects('resolveConfigs')
        .resolves({ config: { disablePurchaseType: { purchase: [] } } });
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      await priceDecorator.decorator(products, context as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.be.empty;
      mockEligibility.verify();
    });
    it('should have purchase option for subscription if track has s3Path for local media', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Album,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 1.0 } },
          fulfillmentType: 'digital',
          childProducts: [
            ModelFactory.product({
              productTypeId: ProductTypeIds.Track,
              source: { s3Path: 'test' },
            }),
          ],
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager
        .expects('resolveConfigs')
        .resolves({ config: { disablePurchaseType: { purchase: [] } } });
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      await priceDecorator.decorator(products, context as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.not.be.empty;
      mockEligibility.verify();
    });
    it('should have purchase option for digital purchase when disabled but price is 0', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Game,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 0.0 } },
          fulfillmentType: 'digital',
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager.expects('resolveConfigs').resolves({
        config: { disablePurchaseType: { purchase: [ProductTypeIds.Game] } },
      });
      await priceDecorator.decorator(products, context as any);
      const pricedProduct = products[0];
      expect(pricedProduct.purchaseOptions).to.not.be.empty;
      mockEligibility.verify();
    });
    it('should handle multiple disabled / not disabled purchase and fulfillment types', async () => {
      const context = {
        temp: 'test',
        customerId: faker.random.number(10000).toString(),
        siteId: faker.random.number(10000).toString(),
      };
      const products = [
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Game,
          productId: 123,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 1.0 } },
        } as any as Product),
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Track,
          productId: 124,
          purchaseTypes: ['purchase'],
          meta: { basePrice: { purchase: 2.0 } },
        } as any as Product),
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.Movie,
          productId: 125,
          purchaseTypes: ['rental'],
          meta: { basePrice: { rental: 3.0 } },
        } as any as Product),
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.TvEpisode,
          productId: 126,
          purchaseTypes: ['rental'],
          meta: { basePrice: { rental: 21.0 } },
        } as any as Product),
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.GameSubscription,
          productId: 127,
          purchaseTypes: ['subscription'],
          meta: { basePrice: { subscription: 12.0 } },
        } as any as Product),
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.MusicSubscription,
          productId: 128,
          purchaseTypes: ['subscription'],
          meta: { basePrice: { subscription: 10.0 } },
        } as any as Product),
        // Free product don't exclude
        ModelFactory.pricedProduct({
          productTypeId: ProductTypeIds.GameSubscription,
          productId: 128,
          purchaseTypes: ['subscription'],
          meta: { basePrice: { subscription: 0.0 } },
        } as any as Product),
      ];
      mockEligibility
        .expects('getEligibility')
        .resolves(ModelFactory.defaultEligibility());
      mockFeeDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context)
        .resolves([
          ModelFactory.fee({ amount: 0.5, percent: false, name: '50 cent' }),
        ]);
      mockContextConfigManager.expects('resolveConfigs').resolves({
        config: {
          disablePurchaseType: {
            purchase: [ProductTypeIds.Game, ProductTypeIds.Accessory],
            rental: [ProductTypeIds.Movie],
            subscription: [ProductTypeIds.GameSubscription],
          },
        },
      });
      await priceDecorator.decorator(products, context as any);
      expect(products[0].purchaseOptions).to.be.empty;
      expect(products[1].purchaseOptions).to.not.be.empty;
      expect(products[2].purchaseOptions).to.be.empty;
      expect(products[3].purchaseOptions).to.not.be.empty;
      expect(products[4].purchaseOptions).to.be.empty;
      expect(products[5].purchaseOptions).to.not.be.empty;
      expect(products[5].purchaseOptions).to.not.be.empty;
      mockEligibility.verify();
    });
  });
  describe('buildPurchaseOptionForProduct', () => {
    it('@slow properly handles all fees from 0.01 to 10.00 without rounding errors', async () => {
      for (let feeAmount = 0.01; feeAmount <= 10; feeAmount += 0.01) {
        // convert all decimal amounts to integers
        const to = (amount: number) => Math.round(100 * amount);

        const fees = [
          ModelFactory.fee({
            amount: feeAmount,
            percent: false,
            name: '50 cent',
          }),
        ];
        const basePrice = parseFloat(faker.finance.amount(0.5, 10));
        const total = (to(basePrice) + to(feeAmount)) / 100;

        const product = ModelFactory.pricedProduct({
          productId: 123,
          purchaseTypes: ['rental'],
          meta: { basePrice: { rental: basePrice } },
        } as any as Product);
        const purchaseOption = (
          priceDecorator as any
        ).buildPurchaseOptionForProduct('rental', product, fees, {
          disablePurchaseType: { purchase: [], rental: [], subscription: [] },
        });
        assert.equal(purchaseOption.totalPrice, total);
        assert.equal(purchaseOption.priceDetails.length, 2);
        assert.equal(purchaseOption.type, 'rental');
      }
    }).timeout(4000);
  });
  describe('buildPurchaseOptionForMemberProduct', () => {
    it('adds subscription purchase option for product without subscriptionIds', async () => {
      const product = ModelFactory.product({
        productId: 11,
        subscriptionIds: [11],
      } as any as Product);
      const subscriptionPriceDetails = [
        {
          name: 'Price',
          amount: 0,
          type: PriceDetailType.Price,
        },
      ];
      const purchaseOption = await (
        priceDecorator as any
      ).buildPurchaseOptionForMemberProduct(product);

      assert.equal(purchaseOption.type, 'subscription');
      expect(purchaseOption.priceDetails).to.deep.equal(
        subscriptionPriceDetails,
      );
    });
    it('does not add subscription purchase option for empty subscriptionIds', async () => {
      const product = ModelFactory.product({
        productId: 11,
        subscriptionIds: [],
      } as any as Product);
      const purchaseOption = await (
        priceDecorator as any
      ).buildPurchaseOptionForMemberProduct(product);

      expect(purchaseOption).to.be.undefined;
    });
  });
  describe('getDecoratorFields', () => {
    it('returns fields that have been added to products by decorators', async () => {
      const decoratorFields = priceDecorator.getDecoratorFields();
      expect(decoratorFields).to.deep.equal([
        'meta.effectivePrice',
        'purchaseOptions',
        'subscriptionIds',
      ]);
    });
  });
});
