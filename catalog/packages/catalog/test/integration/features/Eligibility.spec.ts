import {
  ContextConfigApi,
  ContextConfigApiApiKeyAuthMethods,
} from '@securustablets/libraries.context-config.client';
import { InmateJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { EligibilityApi } from '@securustablets/services.eligibility.client';
import { InmateApi } from '@securustablets/services.inmate.client/dist/api';
import { expect } from 'chai';
import * as faker from 'faker';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import {
  PriceDetailType,
  ProductStatus,
  PurchaseOption,
} from '../../../src/controllers/models/Product';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeManager } from '../../../src/lib/ProductTypeManager';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('Eligibility - Integration', function () {
  this.timeout(8000);
  let testToken: string;
  let eligibleInmate: InmateJwt;
  let eligibleInmateJwt: string;
  let ineligibleInmate: InmateJwt;
  let ineligibleInmateJwt: string;

  const eligibilityApi: EligibilityApi = Container.get(EligibilityApi);
  const contextConfigApi: ContextConfigApi = Container.get(ContextConfigApi);
  const inmateApi: InmateApi = Container.get(InmateApi);

  let productDao: ProductDao;

  contextConfigApi.basePath = eligibilityApi.basePath;

  let productId: number;
  let randomCustomerId: string;

  before(async () => {
    testToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin', 'customerAdmin'],
      }),
    );

    contextConfigApi.setApiKey(
      ContextConfigApiApiKeyAuthMethods.corpJwt,
      'Bearer ' + testToken,
    );
    randomCustomerId = faker.random.number(10000000).toString();

    eligibleInmate = await SecurityFactory.inmateJwt({
      customerId: randomCustomerId,
    });
    eligibleInmateJwt = await SecurityFactory.jwt(eligibleInmate);
    ineligibleInmate = await SecurityFactory.inmateJwt({
      customerId: randomCustomerId,
    });
    ineligibleInmateJwt = await SecurityFactory.jwt(ineligibleInmate);

    await setupEligibilityRestrictions(randomCustomerId);
    await setupInmateEligibility(eligibleInmate, 'good');
    await setupInmateEligibility(ineligibleInmate, 'bad');
  });

  beforeEach(async () => {
    await IntegrationTestSuite.enableProductTypes(
      ['movie'],
      [{ customerId: randomCustomerId }],
    );
    productDao = Container.get(ProductDao);
    const productTypeMan = new ProductTypeManager();
    const productSchema = await productTypeMan.getProductType('movie');
    const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
      status: ProductStatus.Active,
      purchaseCode: 'VIDEO',
      meta: { basePrice: { rental: 10.88 } },
    });
    productId = await productDao.create(product, { apiKey: 'test' });
  });

  async function setupEligibilityRestrictions(customerId: string) {
    return await contextConfigApi.create({
      customerId: customerId,
      siteId: null,
      config: {
        classRestrictions: [
          {
            className: 'good',
            disableMediaPurchase: false,
            disableApps: [],
            disableSubscription: false,
          },
          {
            className: 'bad',
            disableMediaPurchase: true,
            disableApps: [],
            disableSubscription: false,
          },
        ],
      },
    });
  }

  async function setupInmateEligibility(
    inmateJwt: InmateJwt,
    custodyClass: string,
  ) {
    await inmateApi.create(
      ModelFactory.inmateFromJwt(inmateJwt, {
        custodyClass: custodyClass,
        active: true, // Someone decided to create inmates that weren't active and somehow the tests before worked but I'm not salty about having to figure out what was going on
      }),
    );
  }

  describe('feature toggle', () => {
    it('should not return purchase options for ineligible inmates when disableMediaPurchase', async () => {
      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${ineligibleInmateJwt}`)
        .expect(200)
        .then(async (response) => {
          expect(response.body.purchaseOptions).to.be.empty;
        });
    });
    it('should return purchase options for eligible inmates when not disableMediaPurchase', async () => {
      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${eligibleInmateJwt}`)
        .expect(200)
        .then(async (response) => {
          const purchaseOptions: PurchaseOption[] = [
            {
              priceDetails: [
                {
                  amount: 10.88,
                  name: 'Price',
                  type: PriceDetailType.Price,
                },
              ],
              totalPrice: 10.88,
              type: 'rental',
            },
          ];
          expect(response.body.purchaseOptions).to.deep.equal(purchaseOptions);
        });
    });
  });
});
