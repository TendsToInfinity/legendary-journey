import { JwtType } from '@securustablets/libraries.httpsecurity';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { SpAttributes } from '@securustablets/libraries.json-schema/dist/src/models/SpLite';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import * as request from 'supertest';
import * as util from 'util';
import { VendorNames } from '../../../src/controllers/models/Product';
import { ProductType } from '../../../src/lib/models/ProductType';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('ProductTypeController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let corpJwt: string;
  before(async () => {
    corpJwt = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );
  });
  describe('getProductType', () => {
    it('gets a productType', async () => {
      return request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200)
        .then((response) => {
          expect(_.keys(response.body)).to.include.members([
            'productTypeId',
            'purchaseCode',
            'purchaseTypes',
            'jsonSchema',
            'cdate',
            'udate',
          ]);
          expect(_.pick(response.body, 'available')).to.deep.equal({
            available: false,
          });
        });
    });
    it('verify tabletPackage productTypes', async () => {
      return request(app)
        .get(`/productTypes/tabletPackage`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200)
        .then((response) => {
          // Should be values from PackageType enum
          expect(
            response.body.jsonSchema.properties.meta.properties.type.enum
              .length,
          ).to.equal(6);
          expect(
            response.body.jsonSchema.properties.meta.properties.type.enum,
          ).to.have.members([
            'community',
            'officer',
            'personal',
            'pool',
            'warehouse',
            'inventory',
          ]);
        });
    });

    it('gets a productType with rule applied', async () => {
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(
          ModelFactory.productTypeAvailabilityRule({
            customerId: 'I-123456',
            productTypeId: 'movie',
            action: { available: true },
          }),
        )
        .expect(200);

      return request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .query({ customerId: 'I-123456' })
        .expect(200)
        .then((response) => {
          expect(_.keys(response.body)).to.include.members([
            'productTypeId',
            'purchaseCode',
            'purchaseTypes',
            'jsonSchema',
            'cdate',
            'udate',
          ]);
          expect(_.pick(response.body, 'available')).to.deep.equal({
            available: true,
          });
        });
    });
    it('gets a 404', async () => {
      return request(app)
        .get(`/productTypes/123456`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(404)
        .then((response) => {
          expect(response.body.errors[0]).to.equal(
            `No ProductType found matching { productTypeId: '123456' }`,
          );
        });
    });
  });
  describe('getProductTypes', () => {
    const rules = [
      ModelFactory.productTypeAvailabilityRule({
        customerId: 'I-123456',
        productTypeId: 'movie',
        action: { available: true },
      }),
      ModelFactory.productTypeAvailabilityRule({
        customerId: 'I-123456',
        productTypeId: 'tvShow',
        action: { available: true },
      }),
      ModelFactory.productTypeAvailabilityRule({
        customerId: 'I-123456',
        siteId: '11111',
        productTypeId: 'movie',
        action: { available: false },
      }),
    ];

    beforeEach(async () => {
      await Bluebird.map(rules, async (rule) => {
        await request(app)
          .post(`/rules`)
          .set('Authorization', `Bearer ${corpJwt}`)
          .send(rule)
          .expect(200);
      });
    });

    const scenarios = [
      {
        context: {},
        expectedProductTypes: [],
      },
      {
        context: { customerId: 'I-123456' },
        expectedProductTypes: [
          { productTypeId: 'movie', available: true },
          { productTypeId: 'tvShow', available: true },
        ],
      },
      {
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedProductTypes: [{ productTypeId: 'tvShow', available: true }],
      },
    ];

    for (const scenario of scenarios) {
      it(`gets all productTypes with rules applied for context ${util.inspect(scenario.context)}`, async () => {
        return request(app)
          .get(`/productTypes`)
          .set('X-API-KEY', 'API_KEY_DEV')
          .query(scenario.context)
          .expect(200)
          .then((response) => {
            response.body.forEach((schema) => {
              expect(_.keys(schema)).to.include.members([
                'productTypeId',
                'purchaseCode',
                'purchaseTypes',
                'jsonSchema',
                'cdate',
                'udate',
              ]);
            });
            expect(
              _.filter(
                response.body.map(({ productTypeId, available }) => ({
                  productTypeId,
                  available,
                })),
                { available: true },
              ),
            ).to.have.deep.members(scenario.expectedProductTypes);
          });
      });
    }
  });
  describe('getProductTypeAggregations', () => {
    it('gets aggregations for a productType', async () => {
      let productType = await request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200)
        .then((response) => response.body);
      await request(app)
        .get(`/productTypes/movie/aggregations`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200)
        .then((response) => {
          const jsp = new JsonSchemaParser(productType.jsonSchema);
          const schemas = jsp.getSchemasByField(
            SpAttributes.AutoComplete,
            true,
          );
          schemas.forEach((value) => {
            // assert that the response has all of the autoComplete values from the schema
            const field = _.find(response.body.fields, ['name', value.name]);
            assert.isDefined(field, `Missing ${value.name} from response`);
            assert.equal(field.path, value.path, 'Wrong path');
            assert.isArray(field.values, 'Values is not an array');
          });
        });

      productType = await request(app)
        .get(`/productTypes/album`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200)
        .then((response) => response.body);
      const category = faker.random.word();

      const genres: string[] = ['pop', 'rock', 'latin', 'POP', 'Latin'];
      const product = ModelFactory.productFromSchema(productType.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic, genres: genres },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          categories: [category],
          releaseYear: 2022,
        },
      });

      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200);

      return request(app)
        .get(`/productTypes/album/aggregations`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200)
        .then((response) => {
          const jsp = new JsonSchemaParser(productType.jsonSchema);
          const schemas = jsp.getSchemasByField(
            SpAttributes.AutoComplete,
            true,
          );
          schemas.forEach((value) => {
            // assert that the response has all of the autoComplete values from the schema
            const field = _.find(response.body.fields, ['name', value.name]);
            if (field.path === 'meta.genres') {
              // case insensitive DPV
              assert.equal(field.values.length, 3);
            }
            assert.isDefined(field, `Missing ${value.name} from response`);
            assert.equal(field.path, value.path, 'Wrong path');
            assert.isArray(field.values, 'Values is not an array');
            if (_.isUndefined(value.enum)) {
              assert.isTrue(field.values.length > 0, 'Values is empty');
            }
          });
        });
    });
  });
  describe('update', () => {
    it('should update its Meta', async () => {
      const existingProductType = await request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200);
      const requestProductType: ProductType = {
        ...existingProductType.body,
        meta: {
          displayName: faker.random.word(),
          globalAvailability: faker.random.boolean(),
          autoIngest: faker.random.boolean(),
          telemetry: faker.random.boolean(),
        },
      };
      await request(app)
        .put('/productTypes/movie')
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(requestProductType)
        .expect(204);

      // Clear the cache
      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(204);

      const result = await request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`);
      assert.equal(
        result.body.meta.displayName,
        requestProductType.meta.displayName,
      );
      assert.equal(
        result.body.meta.telemetry,
        requestProductType.meta.telemetry,
      );
      assert.equal(
        result.body.meta.autoIngest,
        requestProductType.meta.autoIngest,
      );
      assert.equal(
        result.body.meta.globalAvailability,
        requestProductType.meta.globalAvailability,
      );
    });
    it('should only allowed to update its Meta', async () => {
      const existingProductType = await request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200);
      const requestProductType: ProductType = {
        ...existingProductType.body,
        purchaseCode: faker.random.word(),
      };
      const response = await request(app)
        .put('/productTypes/movie')
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(requestProductType)
        .expect(400);
      assert.equal(
        response.body.errors[0],
        'Only updates to "meta" are allowed',
      );
    });

    it('should update its Meta when restrictedAccess does not exist', async () => {
      const existingProductType = await request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200);

      const { restrictedAccess, ...rest } = existingProductType.body.meta;

      const requestProductType: ProductType = {
        ...existingProductType.body,
        meta: {
          ...rest,
        },
      };
      await request(app)
        .put('/productTypes/movie')
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(requestProductType)
        .expect(204);
      const result = await request(app)
        .get(`/productTypes/movie`)
        .set('Authorization', `Bearer ${corpJwt}`);
      assert.deepEqual(result.body.meta, requestProductType.meta);
    });
  });
});
