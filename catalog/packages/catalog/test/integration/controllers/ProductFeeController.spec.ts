import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import * as util from 'util';
import { Fee } from '../../../src/controllers/models/Fee';
import {
  Product,
  ProductStatus,
} from '../../../src/controllers/models/Product';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('ProductFeeController - Integration', function () {
  IntegrationTestSuite.setUp(this);

  let corpJwt: string;
  let noPermJwt: string;
  const productTypeDao: ProductTypeDao = Container.get(ProductTypeDao);
  let movieSchema: Schema;
  let tvShowSchema: Schema;

  before(async () => {
    corpJwt = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );

    noPermJwt = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
      }),
    );

    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
    tvShowSchema = (await productTypeDao.findOneOrFail('tvShow')).jsonSchema;
  });

  async function createProducts(products: Product[]): Promise<number[]> {
    return Bluebird.map(products, async (product) => {
      const {
        body: { productId },
      } = await request(app)
        .post(`/products`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(product)
        .expect(200);
      return productId;
    });
  }

  async function createFees(fees: Fee[]): Promise<number[]> {
    return Bluebird.map(fees, async (fee) => {
      const {
        body: { feeId },
      } = await request(app)
        .post('/fees')
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(fee)
        .expect(200);
      return feeId;
    });
  }

  describe('find', () => {
    let products: Product[];
    let productIds: number[];
    let fees: Fee[];
    let feeIds: number[];

    beforeEach(async () => {
      products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'The Shining' },
        }),
        ModelFactory.productFromSchema(tvShowSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'Freaks and Geeks', airDate: '2020-02-22' },
        }),
      ];

      fees = [
        ModelFactory.fee({
          productTypeId: 'movie',
          customerId: 'I-123456',
          amount: 50,
          percent: true,
          clauses: { 'meta.name': ['The Shining'] },
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '11111',
          amount: 5,
          percent: false,
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '22222',
          amount: 7,
          percent: true,
        }),
        ModelFactory.fee({
          productTypeId: 'tvShow',
          customerId: 'I-123456',
          siteId: '22222',
          amount: 25,
          percent: true,
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          amount: 1,
          percent: false,
        }),
        ModelFactory.fee({
          productTypeId: 'tvShow',
          amount: 1,
          percent: false,
        }),
        ModelFactory.fee({
          productTypeId: 'tvShow',
          customerId: 'I-123456',
          siteId: '22222',
          amount: 0,
          percent: false,
        }),
        ModelFactory.fee({
          productTypeId: 'movie',
          customerId: 'I-123456',
          amount: 50,
          percent: true,
          clauses: { 'meta.name': ['This is a test'] },
        }),
      ];
      [productIds, feeIds] = await Promise.all([
        createProducts(products),
        createFees(fees),
      ]);
    });

    const scenarios: Array<{
      product: number;
      context: object;
      expectedFees: number[];
    }> = [
      { product: 0, context: {}, expectedFees: [4] },
      { product: 0, context: { customerId: 'I-123456' }, expectedFees: [0, 4] },
      {
        product: 0,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedFees: [0, 1, 4],
      },
      {
        product: 0,
        context: { customerId: 'I-123456', siteId: '22222' },
        expectedFees: [0, 2, 4],
      },
      { product: 1, context: {}, expectedFees: [5] },
      { product: 1, context: { customerId: 'I-123456' }, expectedFees: [5] },
      {
        product: 1,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedFees: [5],
      },
      {
        product: 1,
        context: { customerId: 'I-123456', siteId: '22222' },
        expectedFees: [3, 5, 6],
      },
    ];

    for (const scenario of scenarios) {
      it(`should return ${scenario.expectedFees.length} fee(s) for ${util.inspect({ product: scenario.product, ...scenario.context }, { breakLength: Infinity })}`, async () => {
        const { body } = await request(app)
          .get(`/products/${productIds[scenario.product]}/fees`)
          .set('Authorization', `Bearer ${noPermJwt}`)
          .query(scenario.context)
          .expect(200);

        expect(_.map(body.data, 'feeId')).to.have.members(
          scenario.expectedFees.map((expectedFee) => feeIds[expectedFee]),
        );
      });
    }
    it(`should not contain null for customerId`, async () => {
      const { body } = await request(app)
        .get(`/products/${productIds[0]}/fees`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body.data[0]).to.not.have.property('customerId');
      expect(body.data[0]).to.have.property('feeId');
    });
  });
});
