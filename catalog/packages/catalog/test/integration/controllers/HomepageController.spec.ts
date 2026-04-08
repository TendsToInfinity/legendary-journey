import { CorpJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { assert, expect } from 'chai';
import * as request from 'supertest';
import { Homepage } from '../../../src/controllers/models/Homepage';
import { ProductStatus } from '../../../src/controllers/models/Product';
import { Search } from '../../../src/controllers/models/Search';
import { HomepageDao } from '../../../src/data/PGCatalog/HomepageDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('HomepageController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let homepageDao: HomepageDao;
  let testToken: string;
  let noPermToken: string;
  beforeEach(async () => {
    homepageDao = new HomepageDao();

    const expectedJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
      permissions: ['catalogAdmin'],
    } as CorpJwt;

    testToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(expectedJwt));

    const noPermJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
    } as CorpJwt;

    noPermToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(noPermJwt));
  });

  describe('create', () => {
    it('creates a homepage', () => {
      const homepage: Homepage = {
        displayName: 'Test Display Name',
        productTypeId: 'movie',
        rank: 0,
        search: {
          query: {
            productTypeId: 'movie',
            clauses: { 'meta.genres': ['Rock'] },
          },
        } as Search,
      };

      return request(app)
        .post(`/homepage`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(homepage)
        .expect(200)
        .then(async (response) => {
          assert.isNumber(
            response.body.homepageId,
            'Did not get back a homepage ID',
          );
          const homepageResult = await homepageDao.findOneOrFail(
            response.body.homepageId,
          );
          expect(homepageResult.displayName).to.equal(homepage.displayName);
        });
    });

    it('creates a homepage with explicit orderBy', () => {
      const homepage: Homepage = {
        displayName: 'Test Display Name',
        productTypeId: 'movie',
        rank: 0,
        search: {
          query: {
            clauses: { productId: [1, 2, 3, 4, 5] },
            productTypeId: 'movie',
          },
          orderBy: [{ productId: 'EXPLICIT' }],
        },
      };

      return request(app)
        .post(`/homepage`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(homepage)
        .expect(200)
        .then(async (response) => {
          assert.isNumber(
            response.body.homepageId,
            'Did not get back a homepage ID',
          );
          const homepageResult = await homepageDao.findOneOrFail(
            response.body.homepageId,
          );
          expect(homepageResult.displayName).to.equal(homepage.displayName);
        });
    });

    it('should throw if EXPLICIT orderBy but no clause found matching orderBy key', () => {
      const homepage: Homepage = {
        displayName: 'Test Display Name',
        productTypeId: 'movie',
        rank: 0,
        search: {
          query: {
            clauses: { productId: [...Array(24).keys()] },
            productTypeId: 'movie',
          },
          orderBy: [{ 'meta.year': 'EXPLICIT' }],
        },
      };

      return request(app)
        .post(`/homepage`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(homepage)
        .expect(400);
    });
    it('should throw if more than 100 values are submitted', () => {
      const homepage: Homepage = {
        displayName: 'Test Display Name',
        productTypeId: 'movie',
        rank: 0,
        search: {
          query: {
            clauses: { productId: [...Array(104).keys()] },
            productTypeId: 'movie',
          },
          orderBy: [{ productId: 'EXPLICIT' }],
        },
      };

      return request(app)
        .post(`/homepage`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(homepage)
        .expect(400);
    });
  });

  describe('non-create apis', () => {
    let createdHomepageIds: number[];
    let homepages: Homepage[];

    beforeEach(async () => {
      await IntegrationTestSuite.enableProductTypes(
        ['movie'],
        [{ customerId: null, siteId: null }],
      );
      homepages = [
        {
          displayName: 'Test Display Name 4',
          productTypeId: 'movie',
          rank: 1,
          search: {
            query: {
              clauses: {
                'meta.rating': ['PG-13'],
              },
              productTypeId: 'movie',
            },
          } as Search,
        },
        {
          displayName: 'Test Display Name',
          productTypeId: 'movie',
          rank: 0,
          search: {} as Search,
        },
        {
          displayName: 'Test Display Name 2',
          productTypeId: 'tvShow',
          rank: 0,
          search: {} as Search,
        },
        {
          displayName: 'Test Display Name 3',
          productTypeId: 'movie',
          rank: 1,
          search: {} as Search,
        },
        {
          displayName: 'A1 Super alphabetical name',
          productTypeId: 'movie',
          rank: 10,
          search: {} as Search,
        },
      ];

      createdHomepageIds = await Bluebird.map(homepages, (homepage) =>
        homepageDao.create(homepage, { apiKey: 'test' }),
      );
    });

    describe('findHomepage', () => {
      it('finds a homepage', async () => {
        return request(app)
          .get(`/homepage/${createdHomepageIds[0]}`)
          .set('Authorization', `Bearer ${noPermToken}`)
          .expect(200)
          .then((response) => {
            expect(response.body.displayName).to.equal(
              homepages[0].displayName,
            );
          });
      });
      it('gets a 404', async () => {
        return request(app)
          .get(`/homepage/123456`)
          .set('Authorization', `Bearer ${noPermToken}`)
          .expect(404);
      });
    });

    describe('findHomepageProducts', () => {
      it('finds products for a homepage', async () => {
        const productTypeDao = new ProductTypeDao();

        const movieSchema = (await productTypeDao.findOneOrFail('movie'))
          .jsonSchema;

        const products = [
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'It',
              description: 'lol clowns',
              rating: 'R',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Scary Movie',
              description: "this one's funny and scary",
              rating: 'PG-13',
              basePrice: {
                rental: 0.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Scary Movie 2',
              description: 'the second one',
              rating: 'PG-13',
              basePrice: {
                rental: 1.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Just Movie',
              description: 'movie description',
              rating: 'TV-PG',
              basePrice: {
                rental: 1.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Frozen',
              description: 'disney movie',
              rating: 'G',
              basePrice: {
                rental: 6.33,
              },
            },
          } as any),
        ];

        await IntegrationTestSuite.loadProductsAndRules(products);

        return request(app)
          .get(`/homepage/${createdHomepageIds[0]}/products`)
          .set('Authorization', `Bearer ${noPermToken}`)
          .expect(200)
          .then((response) => {
            expect(_.map(response.body.data, 'meta.name')).to.deep.equal([
              'Scary Movie',
              'Scary Movie 2',
            ]);
          });
      });
      it('gets a 404', async () => {
        return request(app)
          .get(`/homepage/123456/products`)
          .set('Authorization', `Bearer ${noPermToken}`)
          .expect(404);
      });
    });
    describe('findHomepagesByProductType', () => {
      it('finds homepages for a product type in rank + displayName sorted ordere', async () => {
        return request(app)
          .get(`/homepage/productType/movie`)
          .set('Authorization', `Bearer ${noPermToken}`)
          .expect(200)
          .then((response) => {
            expect(_.map(response.body, 'displayName')).to.deep.equal([
              'Test Display Name',
              'Test Display Name 3',
              'Test Display Name 4',
              'A1 Super alphabetical name',
            ]);
          });
      });
    });

    describe('updateHomepage', () => {
      it('updates a homepage', async () => {
        const homepage = {
          ...homepages[0],
          homepageId: createdHomepageIds[0],
          displayName: 'Updated Display Name',
        };

        return request(app)
          .put(`/homepage/${homepage.homepageId}`)
          .set('Authorization', `Bearer ${testToken}`)
          .send(homepage)
          .expect(204)
          .then(async () => {
            expect(
              (await homepageDao.findOneOrFail(homepage.homepageId))
                .displayName,
            ).to.equal(homepage.displayName);
          });
      });

      it('gets a 400', async () => {
        const homepage = {
          ...homepages[0],
          homepageId: createdHomepageIds[0],
          displayName: 'Updated Display Name',
        };
        const homepageId = 99999999;
        return request(app)
          .put(`/homepage/${homepageId}`)
          .set('Authorization', `Bearer ${testToken}`)
          .send(homepage)
          .expect(400)
          .then((response) => {
            expect(response.body.errors[0]).to.equal(
              `Update homepageId ${homepageId} does not equal homepage payload id ${homepage.homepageId}`,
            );
          });
      });

      it('gets a 404', async () => {
        const homepage = {
          ...homepages[0],
          homepageId: 99999999,
          displayName: 'Updated Display Name',
        };
        return request(app)
          .put(`/homepage/${homepage.homepageId}`)
          .set('Authorization', `Bearer ${testToken}`)
          .send(homepage)
          .expect(404);
      });
    });

    describe('deleteHomepage', () => {
      it('deletes a homepage', async () => {
        expect(
          (await homepageDao.findOneOrFail(createdHomepageIds[0])).displayName,
        ).to.equal(homepages[0].displayName);

        return request(app)
          .delete(`/homepage/${createdHomepageIds[0]}`)
          .set('Authorization', `Bearer ${testToken}`)
          .expect(204)
          .then(async () => {
            try {
              await homepageDao.findOneOrFail(createdHomepageIds[0]);
              assert.fail();
            } catch (err) {
              assert.equal(err.code, 404);
            }
          });
      });
    });
  });
});
