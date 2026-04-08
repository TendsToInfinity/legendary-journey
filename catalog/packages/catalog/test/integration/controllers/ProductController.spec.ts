import { ContextConfigTestSupport } from '@securustablets/libraries.context-config';
import { ContextConfigApi } from '@securustablets/libraries.context-config.client';
import { JwtType } from '@securustablets/libraries.httpsecurity';
import { SpLite } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as AWS from 'aws-sdk';
import * as Bluebird from 'bluebird';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import * as jwt from 'jsonwebtoken';
import * as moxios from 'moxios';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import {
  BlockActionBy,
  BlockActionState,
  BlockActionType,
  ManuallyBlockedReason,
} from '../../../src/controllers/models/BlockAction';
import {
  DistinctProductFieldPath,
  Extensions,
  IntervalUnit,
  PriceDetailType,
  Product,
  ProductStatus,
  ProductTypeIds,
  ThumbnailApprovedStatus,
  VendorNames,
} from '../../../src/controllers/models/Product';
import { Rule, RuleType } from '../../../src/controllers/models/Rule';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { DistinctProductValueDao } from '../../../src/data/PGCatalog/DistinctProductValueDao';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { OpenSearchManager } from '../../../src/lib/OpenSearchManager';
import { ProductManager } from '../../../src/lib/ProductManager';
import { ProductTypeManager } from '../../../src/lib/ProductTypeManager';
import { ProductValidator } from '../../../src/lib/ProductValidator';
import { app } from '../../../src/main';
import { AppConfig } from '../../../src/utils/AppConfig';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import { MusicIntegrationTestSuite } from '../MusicIntegrationTestSuit';

import { PackageType } from '../../../src/controllers/models/Package';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { LargeImpactEventDao } from '../../../src/data/PGCatalog/LargeImpactEventDao';
import '../global.spec';

const context = { apiKey: 'test' };

describe('ProductController - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true });
  let testToken: string;
  let productIdOfGameSubscription: number;
  let productId2OfGameSubscription: number;

  let productTypeMan: ProductTypeManager;
  let productMan: ProductManager;
  let productValidator: ProductValidator;
  let productTypeDao: ProductTypeDao;
  let productDao: ProductDao;
  let openSearchManager: OpenSearchManager;
  let ruleDao: RuleDao;
  let contextConfigApi: ContextConfigApi;

  let blockActionDao: BlockActionDao;
  let lieDao: LargeImpactEventDao;

  let blocklistTermDao: BlocklistTermDao;

  before(async () => {
    testToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin', 'customerAdmin'],
      }),
    );
    contextConfigApi = ContextConfigTestSupport.getContextConfigApi(
      app,
      testToken,
    );
  });

  beforeEach(async () => {
    await client.clearCache();
    moxios.install();
    productTypeMan = new ProductTypeManager();
    productMan = new ProductManager();
    productValidator = new ProductValidator();
    productTypeDao = new ProductTypeDao();
    productDao = new ProductDao();
    ruleDao = new RuleDao();
    openSearchManager = new OpenSearchManager();
    blockActionDao = new BlockActionDao();
    lieDao = new LargeImpactEventDao();
    blocklistTermDao = new BlocklistTermDao();
  });

  afterEach(async () => {
    moxios.uninstall();
    sinon.restore();
    await Bluebird.delay(1000);
  });
  after(async () => {
    ContextConfigTestSupport.closeDown();
  });

  describe('searchProducts', () => {
    let rules: Rule[];
    let movieSchema: SpLite;
    let tvShowSchema: SpLite;
    let albumSchema: SpLite;
    let dbProducts: Product[];
    let webViewSchema: SpLite;
    let tabletPackageSchema: SpLite;
    let tabletPackageProductId: number;

    beforeEach(async () => {
      movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
      tvShowSchema = (await productTypeDao.findOneOrFail('tvShow')).jsonSchema;
      albumSchema = (await productTypeDao.findOneOrFail('album')).jsonSchema;
      webViewSchema = (await productTypeDao.findOneOrFail('webView'))
        .jsonSchema;
      tabletPackageSchema = (
        await productTypeDao.findOneOrFail('tabletPackage')
      ).jsonSchema;
      const products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Gone with the wind',
            description: 'i actually have never seen this',
            rating: 'PG',
            basePrice: {
              rental: 5.99,
            },
            cast: [
              {
                name: 'cast name',
                roles: ['director', 'actor'],
              },
            ],
          },
        } as any),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'It',
            description: 'lol clowns',
            rating: 'R',
            basePrice: {
              rental: 5.99,
            },
            cast: [
              {
                name: 'cast name for name - It',
                roles: ['director'],
              },
              {
                name: 'cast name',
                roles: ['actor'],
              },
            ],
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
            name: 'Just Movie',
            description: 'this is a movie',
            rating: 'TV-14',
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
            name: 'Frozen',
            description: 'disney movie',
            rating: 'G',
            basePrice: {
              rental: 6.33,
            },
          },
        } as any),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining',
            description: 'an actual scary movie',
            rating: 'R',
            basePrice: {
              rental: 7.77,
            },
          },
        } as any),
        ModelFactory.productFromSchema(albumSchema, {
          status: ProductStatus.Active,
          isBlocked: true,
          meta: {
            name: 'Blocked Song II',
          },
        } as any),
        ModelFactory.productFromSchema(webViewSchema, {
          meta: {
            name: '2048',
            category: 'games',
            webViewUrl: 'com.uberspot.a2048',
            displayPriority: 1,
          },
          status: ProductStatus.Active,
          productId: 1474,
          productTypeId: 'webView',
          productTypeGroupId: 'apk',
          purchaseTypes: [],
          source: {
            vendorProductId: '10',
          },
        } as any),
        ModelFactory.productFromSchema(webViewSchema, {
          meta: {
            name: 'Solitaire Free Pack',
            category: 'games',
            webViewUrl: 'com.tesseractmobile.solitairefreepack',
            displayPriority: 1,
          },
          status: ProductStatus.Active,
          productId: 1475,
          productTypeId: 'webView',
          productTypeGroupId: 'apk',
          purchaseTypes: [],
          source: {
            vendorProductId: '20',
          },
        } as any),
        ModelFactory.productFromSchema(webViewSchema, {
          meta: {
            name: 'OpenSodoku',
            category: 'games',
            webViewUrl: 'cz.romario.opensudoku',
            displayPriority: 2,
          },
          status: ProductStatus.Active,
          productId: 1476,
          productTypeId: 'webView',
          productTypeGroupId: 'apk',
          purchaseTypes: [],
          source: {
            vendorProductId: '30',
          },
        } as any),
      ];

      rules = [
        ModelFactory.productWebViewRule({
          productTypeId: 'webView',
          customerId: null,
          siteId: null,
          action: {
            meta: {
              effectiveUrl: 'https://elements.com/fire',
              effectiveDisplayPriority: 8,
            },
          },
          clauses: {},
          productId: 10,
        }),
        ModelFactory.productWebViewRule({
          productTypeId: 'webView',
          customerId: '1',
          siteId: null,
          action: {
            meta: {
              effectiveUrl: 'https://elements.com/earth',
              effectiveDisplayPriority: 5,
            },
          },
          clauses: {},
          productId: 20,
        }),
        // This rule should have precedence since its context is more specific.
        ModelFactory.productWebViewRule({
          productTypeId: 'webView',
          customerId: '1',
          siteId: '2',
          action: {
            meta: {
              effectiveUrl: 'https://elements.com/air',
              effectiveDisplayPriority: 7,
            },
          },
          clauses: {},
          productId: 20,
        }),
        ModelFactory.productWebViewRule({
          productTypeId: 'webView',
          customerId: '1',
          siteId: null,
          action: {
            meta: {
              effectiveUrl: 'https://elements.com/water',
              effectiveDisplayPriority: 3,
            },
          },
          clauses: {},
          productId: 30,
        }),
      ];

      dbProducts = await IntegrationTestSuite.loadProductsAndRules(
        products,
        rules,
        [{ customerId: '1' }, { customerId: '1', siteId: '2' }],
        ['movie', 'tvShow', 'album', 'webView', 'tabletPackage'],
      );

      const tabletPkg = ModelFactory.productFromSchema(tabletPackageSchema, {
        meta: {
          demo: false,
          name: 'Kankakee Subscriber',
          type: PackageType.Personal,
          premiumContent: false,
          basePrice: {
            subscription: 30,
          },
          description:
            'Modern high-resolution tablet with applications for job searching, educational content and games. Earbuds included.',
          billingInterval: {
            count: 1,
            interval: IntervalUnit.Months,
          },
        },
        filter: {
          customerId: ['I-003075'],
        },
        source: {
          vendorName: 'securus',
          vendorProductId: 'kankakeeSubscriber',
        },
        status: ProductStatus.Active,
        productId: 1502,
        purchaseCode: 'TABLET',
        productTypeId: 'tabletPackage',
        productTypeGroupId: 'tabletPackage',
        purchaseTypes: ['subscription'],
        childProductIds: [],
        webViews: _.map(
          [dbProducts[8], dbProducts[9], dbProducts[10]],
          (dbProduct) => dbProduct.productId,
        ),
      } as any);

      tabletPackageProductId = await productDao.create(tabletPkg, {
        apiKey: 'test',
      });
    });

    describe('getProducts', () => {
      it('should return all products', async () => {
        const { body } = await request(app)
          .get('/products?enforce=false')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        // 12 is the total amount of recorded stubbed
        expect(body.data.length).to.equal(12);
      });
      it('should return specific products with given "term"', async () => {
        const { body } = await request(app)
          .get('/products?enforce=false&term=scary')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        // 1. Scary Movie - 'scary' in name and description.
        // 2. Scary Movie 2 - 'scary' in name.
        // 3. The Shining - 'scary' in description.
        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'Scary Movie',
          'Scary Movie 2',
          'The Shining',
        ]);
      });
      it('should return products in productId ascending order when requested so', async () => {
        const { body } = await request(app)
          .get(
            '/products?productTypeId=movie&enforce=false&orderBy=productId:asc',
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        const productIds: number[] = body.data.map(
          (product) => product.productId,
        );
        const sortedProductIds = [...productIds].sort((a, b) => a - b);
        expect(productIds).to.deep.equal(sortedProductIds);
      });
      it('should return 400 when no productTypeId or productId in the request but has orderby', async () => {
        await request(app)
          .get('/products?enforce=false&orderBy=productId:asc')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(400);
      });
      it('should return products in productId descending order when requested so', async () => {
        const { body } = await request(app)
          .get(
            '/products?productTypeId=movie&enforce=false&orderBy=productId:desc',
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        const productIds: number[] = body.data.map(
          (product) => product.productId,
        );
        const sortedProductIds = [...productIds].sort((a, b) => b - a);
        expect(productIds).to.deep.equal(sortedProductIds);
      });
      it('should return product with exact productId passed in the request query string', async () => {
        const product = ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Gone with the wind 2',
            description: 'i actually have never seen this 2',
            rating: 'PG 2',
            basePrice: {
              rental: 6.99,
            },
            cast: [
              {
                name: 'cast name for name - Gone with the wind 2',
                roles: ['director', 'actor'],
              },
            ],
          },
        } as any);
        const ids = await IntegrationTestSuite.loadProductsAndRules([product]);
        const { body } = await request(app)
          .get(
            `/products?productTypeId=movie&enforce=false&productId=${ids[0].productId}`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        expect(body.data.length).to.equal(1);
        expect(body.data[0].productId).to.equal(ids[0].productId);
      });
      it('should not return products with other productTypeId when productId passed in the request query string', async () => {
        const product = ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Gone with the wind 2',
            description: 'i actually have never seen this 2',
            rating: 'PG 2',
            basePrice: {
              rental: 6.99,
            },
            cast: [
              {
                name: 'cast name for name - Gone with the wind 2',
                roles: ['director', 'actor'],
              },
            ],
          },
        } as any);
        const products = await IntegrationTestSuite.loadProductsAndRules([
          product,
        ]);
        const otherProductTypeId = 'game';
        const { body } = await request(app)
          .get(
            `/products?productTypeId=${otherProductTypeId}&enforce=false&productId=${products[0].productId}`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        expect(body.data.length).to.equal(0);
      });
      it('should support deep orderBys on SBQS', async () => {
        const product = ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Gone with the wind 2',
            description: 'i actually have never seen this 2',
            rating: 'PG 2',
            basePrice: {
              rental: 6.99,
            },
            cast: [
              {
                name: 'cast name for name - Gone with the wind 2',
                roles: ['director', 'actor'],
              },
            ],
          },
        } as any);
        const products = await IntegrationTestSuite.loadProductsAndRules([
          product,
        ]);
        const { body } = await request(app)
          .get(
            `/products?productTypeId=${product.productTypeId}&enforce=false&productId=${products[0].productId}&orderBy=meta.rating:desc,meta.genres:asc`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        expect(body.data.length).to.equal(1);
      });
    });
    describe('Search', () => {
      it('searches and ranks products according to query', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ term: 'scary' })
          .expect(200);

        // 1. Scary Movie - 'scary' in name and description.
        // 2. Scary Movie 2 - 'scary' in name.
        // 3. The Shining - 'scary' in description.
        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'Scary Movie',
          'Scary Movie 2',
          'The Shining',
        ]);
      });
      it('filters out products with match case insensitive', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'ScAry',
            match: {
              meta: { rating: 'r' },
            },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name')).to.deep.equal(['The Shining']);
      });
      it('filters out products with multi-match case insensitive', async () => {
        await request(app)
          .get(`/test/cache/clear`)
          .set('x-api-key', 'API_KEY_DEV')
          .expect(204);
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'SCARY',
            match: [
              {
                meta: { rating: 'R' },
              },
              {
                meta: { rating: 'Pg-13' },
              },
            ],
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'Scary Movie',
          'Scary Movie 2',
          'The Shining',
        ]);
      });
      it('filters out products with query', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'scary',
            query: {
              productTypeId: 'movie',
              clauses: {
                'meta.rating': ['R', 'PG-13'],
              },
            },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name').sort()).to.deep.equal(
          ['Scary Movie', 'Scary Movie 2', 'The Shining'].sort(),
        );
      });
      it('filters out products with query for movie with TV-14 rating', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'Movie',
            query: {
              productTypeId: 'movie',
              clauses: {
                'meta.rating': ['TV-14'],
              },
            },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name')).to.deep.equal(['Just Movie']);
      });
      it('allows a blank search and match', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(body.data.length).to.equal(12);
      });
      it('supports orderBy with document fields', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { productTypeId: 'movie' },
            orderBy: [{ 'meta.rating': 'ASC' }, { 'meta.name': 'DESC' }],
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'Frozen',
          'Gone with the wind',
          'Scary Movie 2',
          'Scary Movie',
          'The Shining',
          'It',
          'Just Movie',
        ]);
      });
      it('400 when no productTypeId or ProductId part of the request but order is', async () => {
        await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            orderBy: [{ 'meta.rating': 'ASC' }, { 'meta.name': 'DESC' }],
          })
          .expect(400);
      });
      it('supports orderBy with non-document fields', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { productTypeId: 'movie' },
            orderBy: { productId: 'ASC' },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name').sort()).to.deep.equal(
          [
            'Gone with the wind',
            'It',
            'Just Movie',
            'Scary Movie',
            'Scary Movie 2',
            'Frozen',
            'The Shining',
          ].sort(),
        );
      });
      it('supports EXPLICIT orderBy', async () => {
        const productList = dbProducts
          .filter((product) => product.productTypeId === 'movie')
          .map((product) => product.productId)
          .slice(1);
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            query: {
              productTypeId: 'movie',
              clauses: {
                productId: productList,
              },
            },
            orderBy: { productId: 'EXPLICIT' },
          })
          .expect(200);

        expect(body.data.map((product) => product.productId)).to.deep.equal(
          productList,
        );
        expect(body.pageSize).to.equal(100);
        expect(body.pageNumber).to.equal(0);
      });
      it('allows pagination of results', async () => {
        // Page through all 8 movies movies with a page size of 2.
        // The fourth page should end up having no results (since we only have 6 movies).
        const { body: firstPage } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ pageSize: 2, pageNumber: 0, total: true })
          .expect(200);
        expect(firstPage.data.length).to.equal(2);
        expect(firstPage.total).to.equal(12);

        const { body: secondPage } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ pageSize: 2, pageNumber: 1 })
          .expect(200);
        expect(secondPage.data.length).to.equal(2);
        expect(secondPage.total).to.equal(undefined);

        const { body: thirdPage } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ pageSize: 2, pageNumber: 2 })
          .expect(200);
        expect(thirdPage.data.length).to.equal(2);

        const { body: fourthPath } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ pageSize: 2, pageNumber: 4 })
          .expect(200);
        expect(fourthPath.data.length).to.equal(2);

        // Make sure no pages had duplicates.
        expect(
          _.uniqBy(
            [...firstPage.data, ...secondPage.data, ...thirdPage.data],
            'productId',
          ).length,
        ).to.equal(6);
      });
      it('filters out all other products other than with the cast name - "cast name for name - It"', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'movie',
              meta: { cast: [{ name: 'cast name for name - It' }] },
            },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name')).to.deep.equal(['It']);
      });
      it('filters out all other products other than with the cast name and roles', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'movie',
              meta: { cast: [{ name: 'cast name', roles: ['actor'] }] },
            },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'Gone with the wind',
          'It',
        ]);
      });
      it('search products with purchase types', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { productTypeId: 'movie', purchaseTypes: ['rental'] },
          })
          .expect(200);

        expect(_.map(body.data, 'meta.name').sort()).to.deep.equal(
          [
            'Gone with the wind',
            'It',
            'Just Movie',
            'Scary Movie',
            'Scary Movie 2',
            'Frozen',
            'The Shining',
          ].sort(),
        );
      });
      it('search products with childProductIds', async () => {
        const grandchildProductId = await productMan.createProduct(
          ModelFactory.productFromSchema(movieSchema),
          { apiKey: 'test' },
        );
        const child1ProductId = await productMan.createProduct(
          ModelFactory.productFromSchema(movieSchema, {
            childProductIds: [grandchildProductId],
          }),
          { apiKey: 'test' },
        );
        const child2ProductId = await productMan.createProduct(
          ModelFactory.productFromSchema(movieSchema),
          { apiKey: 'test' },
        );
        const product1 = ModelFactory.productFromSchema(movieSchema, {
          childProductIds: [child1ProductId, child2ProductId],
        });
        const product2 = ModelFactory.productFromSchema(movieSchema, {
          childProductIds: [child1ProductId, child2ProductId],
        });
        const product1Id = await productMan.createProduct(product1, {
          apiKey: 'test',
        });
        const product2Id = await productMan.createProduct(product2, {
          apiKey: 'test',
        });

        await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'movie',
              childProductIds: [child1ProductId],
            },
          })
          .expect(200)
          .then((response) => {
            expect(_.map(response.body.data, 'meta.name')).to.deep.equal([
              product1.meta.name,
              product2.meta.name,
            ]);
          });
        await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'movie',
              childProductIds: [grandchildProductId],
            },
          })
          .expect(200)
          .then((response) => {
            expect(_.map(response.body.data, 'productId')).to.deep.equal([
              child1ProductId,
            ]);
          });

        return await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'movie',
              childProductIds: [child1ProductId, child2ProductId],
            },
          })
          .expect(200)
          .then((response) => {
            expect(_.map(response.body.data, 'productId').sort()).to.deep.equal(
              [product1Id, product2Id].sort(),
            );
          });
      });
      it('Caches for inmateJwt but not corpJwt when OpenSearch is used', async () => {
        const inmateJwt = await SecurityFactory.jwt(
          SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
        );

        const description = 'the second one';
        const originalName = 'Scary Movie 2';
        const newName = 'Not so Scary';
        const search = {
          query: {
            clauses: { 'meta.description': [description] },
            productTypeId: 'movie',
          },
        };

        const {
          body: { data: inmateProductsBefore },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${inmateJwt}`)
          .send(search)
          .expect(200);
        const inmateProductBefore = inmateProductsBefore[0];

        const {
          body: { data: corpProductsBefore },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send(search)
          .expect(200);

        expect(inmateProductBefore?.meta.name).to.deep.equal(originalName);
        expect(corpProductsBefore[0]?.meta.name).to.deep.equal(originalName);

        inmateProductBefore.meta.name = newName;
        const newProduct = await productDao.updateAndRetrieve(
          inmateProductBefore.productId,
          inmateProductBefore,
          {},
        );
        await openSearchManager.digestProductsIntoOpenSearch([newProduct]);

        const {
          body: { data: inmateProductsAfter },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${inmateJwt}`)
          .send(search)
          .expect(200);

        const {
          body: { data: corpProductsAfter },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send(search)
          .expect(200);

        expect(inmateProductsAfter[0]?.meta.name).to.deep.equal(originalName);
        expect(corpProductsAfter[0]?.meta.name).to.deep.equal(newName);
      });
      it('Caches for inmateJwt but not corpJwt when OpenSearch is NOT used', async () => {
        const inmateJwt = await SecurityFactory.jwt(
          SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
        );

        const description = 'the second one';
        const originalName = 'Scary Movie 2';
        const newName = 'Not so Scary';
        const search = { match: { meta: { description } } };

        const {
          body: { data: inmateProductsBefore },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${inmateJwt}`)
          .send(search)
          .expect(200);
        const inmateProductBefore = inmateProductsBefore[0];

        const {
          body: { data: corpProductsBefore },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send(search)
          .expect(200);

        expect(inmateProductBefore?.meta.name).to.deep.equal(originalName);
        expect(corpProductsBefore[0]?.meta.name).to.deep.equal(originalName);

        inmateProductBefore.meta.name = newName;
        const newProduct = await productDao.updateAndRetrieve(
          inmateProductBefore.productId,
          inmateProductBefore,
          {},
        );
        await openSearchManager.digestProductsIntoOpenSearch([newProduct]);

        const {
          body: { data: inmateProductsAfter },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${inmateJwt}`)
          .send(search)
          .expect(200);

        const {
          body: { data: corpProductsAfter },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send(search)
          .expect(200);

        expect(inmateProductsAfter[0]?.meta.name).to.deep.equal(originalName);
        expect(corpProductsAfter[0]?.meta.name).to.deep.equal(newName);
      });
    });
    describe('Availability', () => {
      it('should enforce a context when using inmateJwt authentication', async () => {
        const inmateJwt = await SecurityFactory.jwt(
          SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
        );

        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              siteId: '2',
              action: { available: false },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${inmateJwt}`)
          .send({
            context: {
              enforce: false,
              customerId: 'i am',
              siteId: 'a big fat liar',
            },
          })
          .expect(200);
        expect(body.data).to.have.lengthOf(10);
      });
      it('should enforce a context when using facilityJwt:beta authentication', async () => {
        const facilityJwt = await SecurityFactory.jwt(
          SecurityFactory.facilityJwtBeta({
            customerId: '1',
          }),
        );

        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              action: { available: false },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${facilityJwt}`)
          .send({
            context: {
              enforce: false,
              customerId: "let me see another customer's datas",
            },
          })
          .expect(200);
        expect(body.data).to.have.lengthOf(
          10,
          JSON.stringify(_.map(body.data, 'meta.name')),
        );
      });
      it('should enforce a context when using facilityJwt authentication', async () => {
        const facilityJwt = await SecurityFactory.jwt(
          SecurityFactory.facilityJwt({
            customerId: '1',
          }),
        );

        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              action: { available: false },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${facilityJwt}`)
          .send({
            context: {
              enforce: false,
              customerId: "let me see another customer's datas",
            },
          })
          .expect(200);
        expect(body.data).to.have.lengthOf(
          10,
          JSON.stringify(_.map(body.data, 'meta.name')),
        );
      });
      it('should support available unless blacklisted model', async () => {
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200);
        expect(body.data).to.have.lengthOf(11);
      });
      it('should support blacklist model', async () => {
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              siteId: '2',
              action: { available: false },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200);
        expect(body.data).to.have.lengthOf(10);
      });
      it('should support whitelist overriding blacklist', async () => {
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              action: { available: false },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              siteId: '2',
              action: { available: true },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200);
        expect(body.data).to.have.lengthOf(11);
      });
      it('should support falling back to customer rules', async () => {
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              action: { available: false },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200);
        expect(body.data).to.have.lengthOf(10);
      });
      it('should support many rules', async () => {
        const rules = [
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['Frozen'] },
          }),
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['The Shining'] },
          }),
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: false },
            clauses: { 'meta.rating': ['PG', 'PG-13'] },
          }),
          // This should override the blacklist and enable this movie
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['Scary Movie'] },
          }),
          // This should override the blacklist and enable this movie
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            action: { available: false },
            clauses: { 'meta.name': ['The Shining'] },
          }),
        ];

        for (const rule of rules) {
          await request(app)
            .post('/rules')
            .set('Authorization', `Bearer ${testToken}`)
            .send(rule)
            .expect(200);
        }

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200);
        expect(
          _.map(body.data, (product) =>
            _.pick(product, 'meta.name', 'available'),
          ),
        ).to.have.deep.members([
          { meta: { name: 'Frozen' }, available: true },
          { meta: { name: 'The Shining' }, available: true },
          { meta: { name: 'It' }, available: true },
          { meta: { name: 'Just Movie' }, available: true },
          { meta: { name: 'Scary Movie' }, available: true },
          { meta: { name: 'Kankakee Subscriber' }, available: true },
          { meta: { name: 'OpenSodoku' }, available: true },
          { meta: { name: 'Solitaire Free Pack' }, available: true },
          { meta: { name: '2048' }, available: true },
        ]);
      });
      it('should support many rules with enforce:false', async () => {
        const rules = [
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['Frozen'] },
          }),
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['The Shining'] },
          }),
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: false },
            clauses: { 'meta.rating': ['PG', 'PG-13'] },
          }),
          // This should have no effect because all PG-13 movies are blacklisted.
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['Scary Movie'] },
          }),
          // This should have no effect because it's a customer level rule and we have site-level rules.
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            action: { available: false },
            clauses: { 'meta.name': ['The Shining'] },
          }),
          ModelFactory.movieAvailabilityRule({
            action: { available: false },
            clauses: { 'meta.name': ['The Shining'] },
          }),
        ];

        for (const rule of rules) {
          await request(app)
            .post('/rules')
            .set('Authorization', `Bearer ${testToken}`)
            .send(rule)
            .expect(200);
        }

        // force OS search
        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            context: { enforce: false, customerId: '1', siteId: '2' },
            match: { productTypeId: 'movie' },
          })
          .expect(200);

        const expectedArray = [
          { meta: { name: 'Gone with the wind' }, available: false },
          { meta: { name: 'It' }, available: true },
          { meta: { name: 'Scary Movie' }, available: true },
          { meta: { name: 'Scary Movie 2' }, available: false },
          { meta: { name: 'Frozen' }, available: true },
          { meta: { name: 'The Shining' }, available: true },
          { meta: { name: 'Just Movie' }, available: true },
        ];
        const returnArray: any = _.map(body.data, (product) =>
          _.pick(product, 'meta.name', 'available'),
        );

        // sort both by name
        returnArray.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
        expectedArray.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

        expect(returnArray).to.deep.equal(expectedArray);
      });
      it('should support rules for different product types', async () => {
        const rules = [
          ModelFactory.tvShowAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: true },
            clauses: { 'meta.name': ['Fargo'] },
          }),
          ModelFactory.movieAvailabilityRule({
            customerId: '1',
            siteId: '2',
            action: { available: false },
            clauses: { 'meta.name': ['Fargo'] },
          }),
        ];

        const products = [
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Fargo',
            } as any,
          }),
          ModelFactory.productFromSchema(tvShowSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Fargo',
              airDate: '2020-02-22',
            } as any,
          }),
        ];

        await IntegrationTestSuite.loadProductsAndRules(products, rules);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'Fargo' } },
            context: { enforce: true, customerId: '1', siteId: '2' },
          })
          .expect(200);

        expect(body.data).to.have.lengthOf(1);
        expect(body.data[0].productTypeId).to.equal('tvShow');
      });
      it('should not enforce availability filtering by default', async () => {
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(
            ModelFactory.movieAvailabilityRule({
              customerId: '1',
              siteId: '2',
              action: { available: true },
              clauses: {
                'meta.name': ['The Shining'],
              },
            }),
          )
          .expect(200);

        const { body } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { customerId: '1', siteId: '2' } })
          .expect(200);
        expect(body.data).to.have.lengthOf(12);
      });
    });
    describe('PricedProducts', () => {
      const rules = [
        // This rule should have precedence since its price is higher.
        ModelFactory.moviePriceRule({
          customerId: '1',
          siteId: '5',
          action: { meta: { effectivePrice: { rental: 12 } } },
          clauses: { 'meta.name': ['Frozen'] },
        }),
        ModelFactory.moviePriceRule({
          customerId: '1',
          siteId: '5',
          action: { meta: { effectivePrice: { rental: 10 } } },
          clauses: { 'meta.name': ['Frozen'] },
        }),
        //   Highest price but disabled make sure it doesn't come back
        ModelFactory.moviePriceRule({
          customerId: '1',
          siteId: '5',
          action: { meta: { effectivePrice: { rental: 20 } } },
          clauses: {},
          enabled: false,
        }),
      ];
      const fees = [
        ModelFactory.fee({
          customerId: '1',
          percent: false,
          amount: 10,
          productTypeId: 'tvShow',
          name: 'customer tvshow fee',
        }),
        ModelFactory.fee({
          customerId: '1',
          percent: false,
          amount: 10,
          productTypeId: 'movie',
          name: 'custFee',
        }),
        ModelFactory.fee({
          customerId: '1',
          percent: true,
          amount: 50,
          productTypeId: 'movie',
          name: 'custPercentFee',
        }),
        ModelFactory.fee({
          customerId: '1',
          siteId: '2',
          percent: false,
          amount: 10,
          productTypeId: 'movie',
          name: 'siteFee',
        }),
        ModelFactory.fee({
          percent: false,
          amount: 1,
          productTypeId: 'movie',
          name: 'clause fee',
          clauses: { 'meta.name': ['Frozen', 'Test'] },
        }),
        ModelFactory.fee({
          percent: false,
          amount: 4,
          productTypeId: 'movie',
          name: 'clause fee does not match',
          clauses: { 'meta.name': ['Does not match'] },
        }),
        ModelFactory.fee({
          customerId: '1',
          siteId: '2',
          percent: true,
          amount: 25,
          productTypeId: 'movie',
          name: 'sitePercentFee',
        }),
        ModelFactory.fee({
          percent: false,
          amount: 1,
          productTypeId: 'movie',
          name: 'disabled fee',
          enabled: false,
        }),
      ];

      beforeEach(async () => {
        await Promise.all([
          Bluebird.map(rules, async (rule) => {
            const {
              body: { ruleId },
            } = await request(app)
              .post('/rules')
              .set('Authorization', `Bearer ${testToken}`)
              .send(rule)
              .expect(200);
            return ruleId;
          }),
          Bluebird.map(fees, async (fee) => {
            const {
              body: { feeId },
            } = await request(app)
              .post('/fees')
              .set('Authorization', `Bearer ${testToken}`)
              .send(fee)
              .expect(200);
            return feeId;
          }),
        ]);
      });

      it('applies customer-level fees with a price override', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'Frozen' } },
            context: { customerId: '1', siteId: '5' },
          })
          .expect(200);

        expect(
          _.pick(
            product,
            'meta.name',
            'meta.basePrice',
            'meta.effectivePrice',
            'purchaseOptions',
          ),
        ).to.deep.equal({
          meta: {
            name: 'Frozen',
            basePrice: { rental: 6.33 },
            effectivePrice: { rental: 12 },
          },
          purchaseOptions: [
            {
              type: 'rental',
              totalPrice: 29,
              priceDetails: [
                { name: 'Price', type: PriceDetailType.Price, amount: 12 },
                { name: 'custFee', type: PriceDetailType.Fee, amount: 10 },
                {
                  name: 'custPercentFee',
                  type: PriceDetailType.Fee,
                  amount: 6,
                },
                { name: 'clause fee', type: PriceDetailType.Fee, amount: 1 },
              ],
            },
          ],
        });
      });

      it('applies fees at both customer and site level', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'Frozen' } },
            context: { customerId: '1', siteId: '2' },
          })
          .expect(200);

        expect(
          _.pick(
            product,
            'meta.name',
            'meta.basePrice',
            'meta.effectivePrice',
            'purchaseOptions',
          ),
        ).to.deep.equal({
          meta: {
            name: 'Frozen',
            basePrice: { rental: 6.33 },
          },
          purchaseOptions: [
            {
              type: 'rental',
              totalPrice: 32.08,
              priceDetails: [
                { name: 'Price', type: PriceDetailType.Price, amount: 6.33 },
                { name: 'custFee', type: PriceDetailType.Fee, amount: 10 },
                {
                  name: 'custPercentFee',
                  type: PriceDetailType.Fee,
                  amount: 3.17,
                },
                { name: 'siteFee', type: PriceDetailType.Fee, amount: 10 },
                { name: 'clause fee', type: PriceDetailType.Fee, amount: 1 },
                {
                  name: 'sitePercentFee',
                  type: PriceDetailType.Fee,
                  amount: 1.58,
                },
              ],
            },
          ],
        });
      });
    });

    describe('WebViewProducts', () => {
      it('applies url and displayPriority webView override at both customer and site level', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'Solitaire Free Pack' } },
            context: { customerId: '1', siteId: '2' },
          })
          .expect(200);

        expect(
          _.pick(
            product,
            'meta.name',
            'meta.webViewUrl',
            'meta.displayPriority',
          ),
        ).to.deep.equal({
          meta: {
            name: 'Solitaire Free Pack',
            webViewUrl: 'https://elements.com/air',
            displayPriority: 7,
          },
        });
      });
      it('applies url and displayPriority webView override at the customer-level ', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'OpenSodoku' } },
            context: { customerId: '1' },
          })
          .expect(200);

        expect(
          _.pick(
            product,
            'meta.name',
            'meta.webViewUrl',
            'meta.displayPriority',
          ),
        ).to.deep.equal({
          meta: {
            name: 'OpenSodoku',
            webViewUrl: 'https://elements.com/water',
            displayPriority: 3,
          },
        });
      });
      it('applies url and displayPriority webView override at just the product level', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: '2048' } },
            context: { customerId: '1' },
          })
          .expect(200);

        expect(
          _.pick(
            product,
            'meta.name',
            'meta.webViewUrl',
            'meta.displayPriority',
          ),
        ).to.deep.equal({
          meta: {
            name: '2048',
            webViewUrl: 'https://elements.com/fire',
            displayPriority: 8,
          },
        });
      });
      it('should get a list of webViews by tablet package product id and have rules applied', async () => {
        const customerId = '1';
        const siteId = '2';
        const context = {
          customerId,
          siteId,
        };
        const inmateJwt = await SecurityFactory.jwt(
          SecurityFactory.inmateJwt(context),
        );
        await request(app)
          .get(`/products/webView/packages/${tabletPackageProductId}`)
          .set('Authorization', `Bearer ${inmateJwt}`)
          .expect(200)
          .then((response) => {
            expect(response.body).to.have.lengthOf(3);
            expect(response.body[0].meta.webViewUrl).to.equal(
              rules[0].action.meta.effectiveUrl,
            );
            expect(response.body[0].meta.displayPriority).to.equal(
              rules[0].action.meta.effectiveDisplayPriority,
            );
            expect(response.body[1].meta.webViewUrl).to.equal(
              rules[2].action.meta.effectiveUrl,
            );
            expect(response.body[1].meta.displayPriority).to.equal(
              rules[2].action.meta.effectiveDisplayPriority,
            );
            expect(response.body[2].meta.webViewUrl).to.equal(
              rules[3].action.meta.effectiveUrl,
            );
            expect(response.body[2].meta.displayPriority).to.equal(
              rules[3].action.meta.effectiveDisplayPriority,
            );
          });
      });
    });

    describe('Caching', () => {
      const rules = [
        ModelFactory.rule({
          type: RuleType.ProductCache,
          customerId: '1',
          siteId: '5',
          action: { cache: true },
          clauses: { 'meta.name': ['Frozen'] },
        }),
      ];

      beforeEach(async () => {
        await Promise.all([
          Bluebird.map(rules, async (rule) => {
            const {
              body: { ruleId },
            } = await request(app)
              .post('/rules')
              .set('Authorization', `Bearer ${testToken}`)
              .send(rule)
              .expect(200);
            return ruleId;
          }),
        ]);
      });

      it('applies default caching value to products', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'It' } },
            context: { customerId: '1', siteId: '5' },
          })
          .expect(200);

        expect(_.pick(product, 'meta.name', 'cache')).to.deep.equal({
          meta: {
            name: 'It',
          },
          cache: false,
        });
      });
      it('applies caching rule to matching products', async () => {
        const {
          body: {
            data: [product],
          },
        } = await request(app)
          .post('/products/search')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: { meta: { name: 'Frozen' } },
            context: { customerId: '1', siteId: '5' },
          })
          .expect(200);

        expect(_.pick(product, 'meta.name', 'cache')).to.deep.equal({
          meta: {
            name: 'Frozen',
          },
          cache: true,
        });
      });
    });
  });
  describe('findProduct', () => {
    let appConfig: AppConfig;
    let mockAppConfig: sinon.SinonMock;

    beforeEach(async () => {
      appConfig = Container.get(AppConfig);
      mockAppConfig = sinon.mock(appConfig);
    });

    it('gets a 404', async () => {
      return request(app)
        .get(`/products/123456`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
    it('gets a product', async () => {
      const productSchema = await productTypeMan.getProductType('movie');
      const productId = await productMan.createProduct(
        ModelFactory.productFromSchema(productSchema.jsonSchema),
        { apiKey: 'test' },
      );
      const response = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      try {
        productValidator.validate(response.body, productSchema.jsonSchema);
      } catch (err) {
        assert.fail();
      }
    });
    it('gets a product for facilityJwt', async () => {
      const context = {
        customerId: faker.random.number(10000).toString(),
      };
      const facilityJwt = await SecurityFactory.jwt(
        SecurityFactory.facilityJwt({
          customerId: context.customerId,
        }),
      );
      await IntegrationTestSuite.enableProductTypes(['movie'], [context]);
      const productId = await productMan.createProduct(
        ModelFactory.activeMovie(),
        { apiKey: 'test' },
      );

      const { body: product } = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${facilityJwt}`)
        .expect(200);

      expect(product.productId).to.equal(productId);
    });
    it('returns 404 for unavailable product for facilityJwt', async () => {
      const context = {
        customerId: faker.random.number(10000).toString(),
      };
      const facilityJwt = await SecurityFactory.jwt(
        SecurityFactory.facilityJwt({
          customerId: context.customerId,
        }),
      );
      await IntegrationTestSuite.enableProductTypes(
        ['movie'],
        [{ customerId: 'other' }],
      );
      const productId = await productMan.createProduct(
        ModelFactory.activeMovie(),
        { apiKey: 'test' },
      );

      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${facilityJwt}`)
        .expect(404);
    });
    it('gets a product with removed rental purchaseType when disabled', async () => {
      const context = {
        customerId: faker.random.number(10000).toString(),
        site: faker.random.number(10000).toString(),
      };
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt(context),
      );
      await IntegrationTestSuite.enableProductTypes(['movie'], [context]);

      const productId = await productMan.createProduct(
        ModelFactory.activeMovie(),
        { apiKey: 'test' },
      );
      const response = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(response.body.purchaseOptions).to.not.be.empty;
      await contextConfigApi.create({
        customerId: context.customerId,
        siteId: null,
        config: {
          disablePurchaseType: {
            rental: ['movie'],
            purchase: [],
            subscription: [],
          },
        },
      });
      await client.clearCache();

      const disabledResponse = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);
      expect(disabledResponse.body.purchaseOptions).to.be.empty;
    });

    it('gets a product by vendor', async () => {
      const productSchema = await productTypeMan.getProductType('movie');
      const productId = await productMan.createProduct(
        ModelFactory.productFromSchema(productSchema.jsonSchema),
        { apiKey: 'test' },
      );

      const response1 = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`);
      const product1 = response1.body;

      const response2 = await request(app)
        .get(`/products/vendor`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .query({
          vendorName: product1.source.vendorName,
          vendorProductId: product1.source.vendorProductId,
          productTypeId: product1.source.productTypeId,
        })
        .expect(200);

      try {
        const product2 = response2.body;
        expect(_.pick(product1, 'source')).to.deep.equal(
          _.pick(product2, 'source'),
        );
      } catch (err) {
        assert.fail();
      }
    });

    it('gets a fully resolved product', async () => {
      const sort = (a, b) => a - b;
      const grandchildProductId = await productDao.create(
        ModelFactory.product(),
        { apiKey: 'test' },
      );
      const child1ProductId = await productDao.create(
        ModelFactory.product({ childProductIds: [grandchildProductId] }),
        { apiKey: 'test' },
      );
      const child2ProductId = await productDao.create(ModelFactory.product(), {
        apiKey: 'test',
      });
      const productId = await productDao.create(
        ModelFactory.product({
          childProductIds: [child1ProductId, child2ProductId],
        }),
        { apiKey: 'test' },
      );
      const productIds = [
        productId,
        child1ProductId,
        child2ProductId,
        grandchildProductId,
      ].sort(sort);

      const { body: result } = await request(app)
        .get(`/products/${productId}?resolve=true`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(result.childProductIds.sort(sort)).to.deep.equal(
        _.map(result.childProducts, 'productId'),
      );
      expect(
        [productId]
          .concat(_.map(result.childProducts, 'productId'))
          .concat(
            _.flatMap(result.childProducts, (cp) =>
              _.map(cp.childProducts, 'productId'),
            ),
          )
          .sort(sort),
      ).to.deep.equal(productIds);
    });
    it('caches find and descendantProducts for inmateId, does not for corp', async () => {
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );

      await IntegrationTestSuite.enableProductTypes(
        ['movie'],
        [{ customerId: '1', siteId: '2' }],
      );
      const child1ProductId = await productDao.create(
        ModelFactory.product({ productTypeId: 'movie' }),
        { apiKey: 'test' },
      );
      const child2ProductId = await productDao.create(
        ModelFactory.product({ productTypeId: 'movie' }),
        { apiKey: 'test' },
      );
      const productId = await productDao.create(
        ModelFactory.product({
          childProductIds: [child1ProductId, child2ProductId],
          productTypeId: 'movie',
        }),
        { apiKey: 'test' },
      );

      const { body: corpBefore } = await request(app)
        .get(`/products/${productId}?resolve=true`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(corpBefore.childProductIds).to.deep.equal([
        child1ProductId,
        child2ProductId,
      ]);

      const { body: inmateJwtBefore } = await request(app)
        .get(`/products/${productId}?resolve=true`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(inmateJwtBefore.childProductIds).to.deep.equal([
        child1ProductId,
        child2ProductId,
      ]);

      const parentProduct = await productDao.findOne(productId);
      parentProduct.meta.name = 'Updated Value';
      parentProduct.childProductIds = [child1ProductId];
      await productDao.update(productId, parentProduct, { apiKey: 'test' });

      const { body: corpAfter } = await request(app)
        .get(`/products/${productId}?resolve=true`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(corpAfter.childProductIds).to.deep.equal([child1ProductId]);
      expect(corpAfter.meta.name).to.equal('Updated Value');

      const { body: inmateJwtAfter } = await request(app)
        .get(`/products/${productId}?resolve=true`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(inmateJwtAfter.childProductIds).to.deep.equal([
        child1ProductId,
        child2ProductId,
      ]);
      expect(inmateJwtAfter.meta.name).to.not.equal('Updated Value');
    });
    it('does not fully resolve products if the resolve flag is not passed', async () => {
      const grandchildProductId = await productDao.create(
        ModelFactory.product(),
        { apiKey: 'test' },
      );
      const child1ProductId = await productDao.create(
        ModelFactory.product({ childProductIds: [grandchildProductId] }),
        { apiKey: 'test' },
      );
      const child2ProductId = await productDao.create(ModelFactory.product(), {
        apiKey: 'test',
      });
      const productId = await productDao.create(
        ModelFactory.product({
          childProductIds: [child1ProductId, child2ProductId],
        }),
        { apiKey: 'test' },
      );

      const { body: result } = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(_.isEmpty(result.childProducts)).to.equal(true);
    });
    it('does not fully resolve products if the resolve flag is passed as false', async () => {
      const grandchildProductId = await productDao.create(
        ModelFactory.product(),
        { apiKey: 'test' },
      );
      const child1ProductId = await productDao.create(
        ModelFactory.product({ childProductIds: [grandchildProductId] }),
        { apiKey: 'test' },
      );
      const child2ProductId = await productDao.create(ModelFactory.product(), {
        apiKey: 'test',
      });
      const productId = await productDao.create(
        ModelFactory.product({
          childProductIds: [child1ProductId, child2ProductId],
        }),
        { apiKey: 'test' },
      );

      const { body: result } = await request(app)
        .get(`/products/${productId}?resolve=false`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(_.isEmpty(result.childProducts)).to.equal(true);
    });

    it('gets a product with sign S3 URL to reduced size path if track', async () => {
      const s3Path = 'am/534057439/534057439.mp3';
      const productId = await productDao.create(
        ModelFactory.product({
          vendorProductId: '1111',
          source: {
            vendorProductId: '534057439',
            vendorName: VendorNames.AudibleMagic,
            s3Path,
          },
          productTypeId: ProductTypeIds.Track,
        }),
        { apiKey: 'test' },
      );

      const { body: result } = await request(app)
        .get(`/products/${productId}?resolve=false&&includeSignedUrl=true`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const signPathUrl = new URL(result.source!.signedUrl!);
      expect(signPathUrl.pathname).to.deep.equal(`/${s3Path}`);
    });

    it('gets a product with sign S3 URL and extension provided in source', async () => {
      const s3Path = 'am/534057439/534057439.mp4';
      const productId = await productDao.create(
        ModelFactory.product({
          vendorProductId: '1111',
          source: {
            vendorProductId: '534057439',
            vendorName: VendorNames.AudibleMagic,
            extension: Extensions.MP4,
            s3Path,
          },
          productTypeId: 'movie',
        }),
        { apiKey: 'test' },
      );

      const { body: result } = await request(app)
        .get(`/products/${productId}?resolve=false&&includeSignedUrl=true`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const signPathUrl = new URL(result.source!.signedUrl!);
      expect(signPathUrl.pathname).to.deep.equal(`/${s3Path}`);
    });

    it('no products should be retrieved with enforce-true,customerId and siteId or with a inmateJWT, with no rule available', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      const productId = await productMan.createProduct(
        ModelFactory.productFromSchema(productSchema.jsonSchema, {
          status: ProductStatus.Inactive,
          isManuallyBlocked: true,
          meta: {
            genres: ['rock'],
          },
        }),
        { apiKey: 'test' },
      );

      await request(app)
        .get(
          `/products/${productId}?resolve=true&enforce=true&customerId=1&siteId=2`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(404);
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      return request(app)
        .get(`/products/${productId}?resolve=false&includeSignedUrl=true`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(404);
    });
    it(`gets a product with enforce-true, customerId and siteId but not with a inmateJWT of a different
        site along with product available rule, and does not upon rule deletion`, async () => {
      // create a active product
      // find the product without enforce - should retrieve the product.
      // retrieve with enforce true and api key, customer and site id - should be 404.
      // Add a product availability rule with meta.name, and then with enforce true, customer and site id and api key - should be 200.
      // retrieve with enforce true and inmateJWT with the same customer and site id - should be 200.
      // retrieve with enforce true and inmateJWT with a different customer and site id - should be 404.
      // delete the rule, retrieve with no enforce - should be 200.
      // retrieve with enforce true, customer and site id and api key - should be 404.
      // retrieve with enforce true and inmateJWT with the same customer and site id - should be 404.
      // retrieve with enforce true and inmateJWT with a different customer and site id - should be 404.
      const productSchema = await productTypeMan.getProductType('album');
      const genres: string[] = [
        faker.random.arrayElement([
          'pop',
          'rock',
          'latin',
          'latin/rock',
          'latin/pop',
        ]),
      ];
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: {
          vendorName: VendorNames.AudibleMagic,
          genres: genres,
          availableForPurchase: true,
        },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          description: faker.random.words(10),
        },
        status: ProductStatus.Active,
      });
      const productId = await productMan.createProduct(product, {
        apiKey: 'test',
      });

      await request(app)
        .get(`/products/${productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);

      // tRue - do not remove the case, testing different cases, as it is converted to uppercase before passing true or false
      await request(app)
        .get(`/products/${productId}?enforce=tRue&customerId=1&siteId=2`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(404);

      const {
        body: { ruleId },
      } = await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(
          ModelFactory.productTypeAvailabilityRule({
            customerId: '1',
            siteId: '2',
            productTypeId: 'album',
            action: { available: true },
            clauses: {
              'meta.name': [product.meta.name],
            },
          }),
        )
        .expect(200);

      // Clear the cache
      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(204);

      // truE - do not remove the case, testing different cases, as it is converted to uppercase before passing true or false
      await request(app)
        .get(`/products/${productId}?enforce=truE&customerId=1&siteId=2`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);

      let inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '4', siteId: '5' }),
      );
      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(404);

      await request(app)
        .delete(`/rules/${ruleId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      // Clear the cache
      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(204);

      await request(app)
        .get(`/products/${productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);

      await request(app)
        .get(`/products/${productId}?enforce=true&customerId=1&siteId=2`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(404);

      inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(404);

      inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '4', siteId: '5' }),
      );
      return request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(404);
    });
    it('should return meta.thumbnail as is if context.enforce set false otherwise apply thumbnail decorator', async () => {
      const cidnFulfillmentService: AppConfig['cidnFulfillmentService'] = {
        cloudFrontKey: '',
        cloudFrontPublicKeyId: '',
        urlExpiresHours: '1',
        cloudFrontDistribution: '',
        cloudFrontArtUrl: faker.internet.url(),
        cloudFrontArtSubfolder: faker.random.word(),
      };
      mockAppConfig
        .expects('get')
        .atLeast(1)
        .withExactArgs('cidnFulfillmentService')
        .returns(cidnFulfillmentService);
      mockAppConfig
        .expects('get')
        .atLeast(1)
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });

      const cloudFrontArtUrl = cidnFulfillmentService.cloudFrontArtUrl;
      const cloudFrontArtSubfolder =
        cidnFulfillmentService.cloudFrontArtSubfolder;

      const productSchema = await productTypeMan.getProductType('album');
      const genres: string[] = [
        faker.random.arrayElement([
          'pop',
          'rock',
          'latin',
          'latin/rock',
          'latin/pop',
        ]),
      ];

      await IntegrationTestSuite.enableProductTypes(
        ['album'],
        [{ customerId: '1' }, { customerId: '1', siteId: '2' }],
      );

      const product1 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          source: {
            vendorName: VendorNames.AudibleMagic,
            genres: genres,
            availableForPurchase: true,
          },
          meta: {
            basePrice: { purchase: 1.5 },
            thumbnail: faker.random.word(),
            thumbnailApproved: ThumbnailApprovedStatus.Pending,
            description: faker.random.words(10),
          },
          status: ProductStatus.Active,
        },
      );
      const product1Id = await productMan.createProduct(product1, {
        apiKey: 'test',
      });

      const product2 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          source: {
            vendorName: VendorNames.AudibleMagic,
            genres: genres,
            availableForPurchase: true,
          },
          meta: {
            basePrice: { purchase: 1.5 },
            thumbnail: faker.random.word(),
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
            description: faker.random.words(10),
          },
          status: ProductStatus.Active,
        },
      );
      const product2Id = await productMan.createProduct(product2, {
        apiKey: 'test',
      });

      await request(app)
        .get(`/products/${product1Id}?enforce=false`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.meta.thumbnailApproved).to.equal(
            product1.meta.thumbnailApproved,
          );
          expect(res.body.meta.thumbnail).to.equal(product1.meta.thumbnail);
        });

      await request(app)
        .get(`/products/${product1Id}?enforce=true&customerId=1&siteId=2`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.meta.thumbnailApproved).to.equal(
            product1.meta.thumbnailApproved,
          );
          expect(res.body.meta.thumbnail).to.equal(
            `${cloudFrontArtUrl}/${product1.productTypeGroupId}/${cloudFrontArtSubfolder}/${genres[0].toLowerCase().replace(/[^a-zA-Z0-9\\s]/, '')}.jpeg`,
          );
        });

      await request(app)
        .get(`/products/${product2Id}?enforce=false`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.meta.thumbnailApproved).to.equal(
            product2.meta.thumbnailApproved,
          );
          expect(res.body.meta.thumbnail).to.equal(product2.meta.thumbnail);
        });

      await request(app)
        .get(`/products/${product2Id}?enforce=true&customerId=1&siteId=2`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.meta.thumbnailApproved).to.equal(
            product2.meta.thumbnailApproved,
          );
          expect(res.body.meta.thumbnail).to.equal(product2.meta.thumbnail);
        });
    });
  });

  describe('updateThumbnailStatusBulk', () => {
    let appConfig: AppConfig;
    let appConfigGetStub: sinon.SinonStub;

    beforeEach(async () => {
      appConfig = Container.get(AppConfig);
      appConfigGetStub = sinon.stub(appConfig as any, 'get');
    });

    it('throw error if approvalStatus params value is not acceptable', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: {
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
          productTypeId: ProductTypeIds.Album,
        },
      });
      const productId = await productDao.create(ModelFactory.product(product), {
        apiKey: 'test',
      });

      await request(app)
        .post(`/products/updateThumbnailStatusBulk`)
        .send({ approvalStatus: 'invalidStatus', productIds: [productId] })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `approvalStatus [invalidStatus] is not allowed`,
          );
        });
    });

    it('update and verify thumbnail status for a product and its child products', async () => {
      const cidnArtApprovalEndpoint = {
        enabled: true,
        baseUrl: 'https://artapproval-api',
        artApprovalEndpoint: 'prod/art-approval',
      };
      appConfigGetStub
        .withArgs('cidnArtApprovalEndpoint')
        .returns(cidnArtApprovalEndpoint);
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });
      AWS.config.update({
        region: 'us-east-1',
        credentials: new AWS.Credentials(
          'accessKeyId',
          'secretAccessKey',
          'sessionToken',
        ),
      });

      // test data
      const trackOverwrites = {
        meta: {
          genres: [
            faker.random.arrayElement([
              'pop',
              'rock',
              'latin',
              'latin/rock',
              'latin/pop',
            ]),
          ],
        },
        productTypeId: ProductTypeIds.Track,
      };
      const albumOverwrites = {
        meta: {
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
          thumbnail: 'Updated Thumbnail',
          productTypeId: ProductTypeIds.Album,
        },
      };

      const albumSchema = (await productTypeMan.getProductType('album'))
        .jsonSchema;
      const trackSchema = (await productTypeMan.getProductType('track'))
        .jsonSchema;
      const album = await MusicIntegrationTestSuite.loadAlbumWithTracks(
        albumSchema,
        trackSchema,
        2,
        albumOverwrites,
        trackOverwrites,
      );
      await openSearchManager.digestProductsIntoOpenSearch([album]);

      const updatedApprovalStatus = faker.random.arrayElement(
        _.values(ThumbnailApprovedStatus),
      );

      const { artApprovalEndpoint } = cidnArtApprovalEndpoint;
      const urlRegex = new RegExp(`${artApprovalEndpoint}.*`);

      moxios.stubRequest(urlRegex, {
        status: 200,
        responseText: '{"data": "success"}',
      });

      await request(app)
        .post(`/products/updateThumbnailStatusBulk`)
        .send({
          approvalStatus: updatedApprovalStatus,
          productIds: [album.productId],
        })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      await request(app)
        .get(`/products/${album.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          assert.equal(
            response.body.meta.thumbnailApproved,
            updatedApprovalStatus,
          );
          assert.equal(response.body.meta.thumbnail, 'Updated Thumbnail');
        });
      await request(app)
        .get(`/products/${album.childProductIds[0]}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          assert.equal(
            response.body.meta.thumbnailApproved,
            updatedApprovalStatus,
          );
          assert.equal(response.body.meta.thumbnail, 'Updated Thumbnail');
        });
      sinon.verify();
    });
  });

  describe('updateThumbnailStatus', () => {
    let appConfig: AppConfig;
    let appConfigGetStub: sinon.SinonStub;

    beforeEach(async () => {
      appConfig = Container.get(AppConfig);
      appConfigGetStub = sinon.stub(appConfig as any, 'get');
    });

    it('gets a 404 if product id doesnt exists', async () => {
      return request(app)
        .post(`/products/123456/updateThumbnailStatus`)
        .send({ approvalStatus: 'blocked' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
    it('update and verify thumbnail status for a product and its child products', async () => {
      const cidnArtApprovalEndpoint = {
        enabled: true,
        baseUrl: 'https://artapproval-api',
        artApprovalEndpoint: 'prod/art-approval',
      };
      appConfigGetStub
        .withArgs('cidnArtApprovalEndpoint')
        .returns(cidnArtApprovalEndpoint);
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });

      const productSchema = await productTypeMan.getProductType('album');

      const child1Product = ModelFactory.product({
        meta: {
          genres: [
            faker.random.arrayElement([
              'pop',
              'rock',
              'latin',
              'latin/rock',
              'latin/pop',
            ]),
          ],
        },
      });
      const child1ProductId = await productDao.create(child1Product, {
        apiKey: 'test',
      });
      const child2Product = ModelFactory.product({
        meta: {
          genres: [
            faker.random.arrayElement([
              'pop',
              'rock',
              'latin',
              'latin/rock',
              'latin/pop',
            ]),
          ],
        },
      });
      const child2ProductId = await productDao.create(child2Product, {
        apiKey: 'test',
      });
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: {
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
          thumbnail: 'Updated Thumbnail',
        },
      });
      const productId = await productDao.create(
        ModelFactory.product({
          ...product,
          childProductIds: [child1ProductId, child2ProductId],
        }),
        { apiKey: 'test' },
      );

      const updatedApprovalStatus = faker.random.arrayElement(
        _.values(ThumbnailApprovedStatus),
      );

      AWS.config.update({
        region: 'us-east-1',
        credentials: new AWS.Credentials(
          'accessKeyId',
          'secretAccessKey',
          'sessionToken',
        ),
      });

      const { artApprovalEndpoint, baseUrl } = cidnArtApprovalEndpoint;
      const urlRegex = new RegExp(`${artApprovalEndpoint}.*`);

      moxios.stubRequest(urlRegex, {
        status: 200,
        responseText: '{"data": "success"}',
      });

      await request(app)
        .post(`/products/${productId}/updateThumbnailStatus`)
        .send({ approvalStatus: updatedApprovalStatus })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          assert.equal(
            response.body.meta.thumbnailApproved,
            updatedApprovalStatus,
          );
          assert.equal(response.body.meta.thumbnail, 'Updated Thumbnail');
        });
      await request(app)
        .get(`/products/${child1ProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          assert.equal(
            response.body.meta.thumbnailApproved,
            updatedApprovalStatus,
          );
          assert.equal(response.body.meta.thumbnail, 'Updated Thumbnail');
        });
      await new Promise<void>((resolve) => {
        moxios.wait(() => {
          const req = moxios.requests.mostRecent();
          expect(req.config.method).to.equal('post');
          expect(req.config.url).to.equal(`${baseUrl}/${artApprovalEndpoint}`);
          expect(req.config.data).to.equal(
            JSON.stringify({
              vendor: product.source.vendorName,
              artApproval: [
                {
                  vendorProductId: child1Product.source.vendorProductId,
                  thumbnailApproved: updatedApprovalStatus,
                  genres: child1Product.meta.genres,
                },
                {
                  vendorProductId: child2Product.source.vendorProductId,
                  thumbnailApproved: updatedApprovalStatus,
                  genres: child2Product.meta.genres,
                },
              ],
            }),
          );
          resolve();
        });
      });
      sinon.verify();
    });
    it('update and verify thumbnail status for a product with thumbnailStatus on schema only', async () => {
      const cidnArtApprovalEndpoint = {
        enabled: true,
        baseUrl: 'https://artapproval-api',
        artApprovalEndpoint: 'prod/art-approval',
      };
      appConfigGetStub
        .withArgs('cidnArtApprovalEndpoint')
        .returns(cidnArtApprovalEndpoint);
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });

      const productSchema = await productTypeMan.getProductType('album');

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: {
          thumbnailApproved: undefined,
          thumbnail: 'Updated Thumbnail',
        },
      });
      const productId = await productDao.create(
        ModelFactory.product({
          ...product,
        }),
        { apiKey: 'test' },
      );

      const updatedApprovalStatus = faker.random.arrayElement(
        _.values(ThumbnailApprovedStatus),
      );

      AWS.config.update({
        region: 'us-east-1',
        credentials: new AWS.Credentials(
          'accessKeyId',
          'secretAccessKey',
          'sessionToken',
        ),
      });

      const { artApprovalEndpoint } = cidnArtApprovalEndpoint;
      const urlRegex = new RegExp(`${artApprovalEndpoint}.*`);

      moxios.stubRequest(urlRegex, {
        status: 200,
        responseText: '{"data": "success"}',
      });

      await request(app)
        .post(`/products/${productId}/updateThumbnailStatus`)
        .send({ approvalStatus: updatedApprovalStatus })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          assert.equal(
            response.body.meta.thumbnailApproved,
            updatedApprovalStatus,
          );
          assert.equal(response.body.meta.thumbnail, 'Updated Thumbnail');
        });
      sinon.verify();
    });
    it('throw error if product doesnt have a thumbnailApproved value on schema', async () => {
      const productSchema = await productTypeMan.getProductType('game');
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      const productId = await productDao.create(ModelFactory.product(product), {
        apiKey: 'test',
      });

      await request(app)
        .post(`/products/${productId}/updateThumbnailStatus`)
        .send({ approvalStatus: 'approved' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `productId [${productId}] is not allowed for thumbnail approval`,
          );
        });
    });
    it('throw error if approvalStatus params value is not acceptable', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { thumbnailApproved: ThumbnailApprovedStatus.Pending },
      });
      const productId = await productDao.create(ModelFactory.product(product), {
        apiKey: 'test',
      });

      await request(app)
        .post(`/products/${productId}/updateThumbnailStatus`)
        .send({ approvalStatus: 'invalidStatus' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `approvalStatus [invalidStatus] is not allowed`,
          );
        });
    });
  });

  describe('createProduct', () => {
    it('gets a 404 for productType', async () => {
      const product = ModelFactory.product({ productTypeId: 'bicycle' });
      return request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(404)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `No ProductType found matching { productTypeId: 'bicycle' }`,
          );
        });
    });
    it('creates a product', async () => {
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { effectivePrice: { rental: 1.5 } },
      });
      let productId;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId = response.body.productId;
        });
      return request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          return expect(response.body.meta.effectivePrice).to.be.undefined;
        });
    });
    it('creates a non subscribable product', async () => {
      const productSchema = await productTypeMan.getProductType('apk');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { effectivePrice: { rental: 1.5 } },
        source: { vendorName: 'APK Vendor' },
      });
      const { body } = await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200);
      return request(app)
        .get(`/products/${body.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          return assert.equal(
            productSchema.subscribable,
            response.body.subscribable,
          );
        });
    });
    it('creates an apk product when meta.category is in lower case', async () => {
      const productSchema = await productTypeMan.getProductType('apk');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { effectivePrice: { rental: 1.5 }, category: 'apk' },
        source: { vendorName: 'APK Vendor' },
      });
      const { body } = await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200);
      return request(app)
        .get(`/products/${body.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          return assert.equal(
            productSchema.subscribable,
            response.body.subscribable,
          );
        });
    });
    it('throws 400 during create an apk product when meta.category is not in lower case', async () => {
      const productSchema = await productTypeMan.getProductType('apk');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { effectivePrice: { rental: 1.5 }, category: 'ApK' },
        source: { vendorName: 'APK Vendor' },
      });
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(400);
    });
    it('creates a subscription product', async () => {
      const productSchema =
        await productTypeMan.getProductType('gameSubscription');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: {
          basePrice: { subscription: 8.99 },
          description: 'Game Subscription',
          billingInterval: {
            count: 1,
            interval: 'months',
          },
        },
        fulfillmentType: 'digital',
        status: 'Active',
        purchaseTypes: ['subscription'],
        source: { vendorName: 'Game Vendor' },
      });
      let productId;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId = response.body.productId;
        });
      return request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          return expect(response.body.subscribable).to.be.true;
        });
    });
    it('creates an album and a track product', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: 'someURL',
          releaseYear: 1984,
        },
      });
      let trackProductId;
      let albumProductId;
      let productResponse;
      const albumName = product.meta.name;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });
      await request(app)
        .get(`/products/${albumProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          productResponse = response.body;
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals(albumName);
          expect(response.body.meta.thumbnailApproved).equals(
            ThumbnailApprovedStatus.Pending,
          );
        });

      const productTrackSchema = await productTypeMan.getProductType('track');
      const trackProduct = ModelFactory.productFromSchema(
        productTrackSchema.jsonSchema,
        {
          source: {
            vendorParentProductId: productResponse.source.vendorProductId,
            vendorName: 'Audible Magic',
          },
          meta: {
            basePrice: {
              purchase: 1.5,
            },
          },
        },
      );

      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(trackProduct)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          trackProductId = response.body.productId;
        });

      await request(app)
        .get(`/products/${trackProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          productResponse = response.body;
          assert.isNumber(response.body.parentProductId);
          assert.equal(response.body.parentProductId, albumProductId);
          expect(response.body.meta.albumName).equals(albumName);
          expect(response.body.meta.thumbnail).equals(product.meta.thumbnail);
          expect(response.body.meta.thumbnailApproved).equals(
            ThumbnailApprovedStatus.Pending,
          );
          expect(response.body.meta.releaseYear).equals(1984);
        });
    });
    it('creates a album product with pending art approval', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic },
        meta: { basePrice: { purchase: 1.5 }, thumbnail: 'someURL' },
      });
      let albumProductId;
      const albumName = product.meta.name;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });
      await request(app)
        .get(`/products/${albumProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals(albumName);
          expect(response.body.meta.thumbnail).equals('someURL');
          expect(response.body.meta.thumbnailApproved).equals(
            ThumbnailApprovedStatus.Pending,
          );
        });
    });
    it('creates a album product applying the meta.genres to source.genres', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      const genres = ['pop', 'rock', 'latin', 'latin/rock', 'latin/pop'];
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          genres: genres,
        },
      });
      let albumProductId;
      const albumName = product.meta.name;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });
      await request(app)
        .get(`/products/${albumProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals(albumName);
          expect(response.body.source.genres).deep.equals(genres);
        });
    });
    it('creates a album product applying the source.genres to meta.genres from distinctProductValue table', async () => {
      const productSchema = await productTypeMan.getProductType('album');
      const category = faker.random.word();
      const distinctProductValueDao = new DistinctProductValueDao();

      await distinctProductValueDao.createAndRetrieve(
        ModelFactory.distinctProductValue({
          sourceValueName: 'pop',
          fieldPath: DistinctProductFieldPath.Genres,
          productTypeGroupId: 'music',
          displayName: 'pop',
        }),
        {},
      );
      await distinctProductValueDao.createAndRetrieve(
        ModelFactory.distinctProductValue({
          sourceValueName: 'rock',
          fieldPath: DistinctProductFieldPath.Genres,
          productTypeGroupId: 'music',
          displayName: 'pop',
        }),
        {},
      );

      const genres: string[] = ['pop', 'rock', 'latin', 'POP', 'Latin'];
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic, genres: genres },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          categories: [category],
        },
      });
      const product1 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          source: { vendorName: VendorNames.AudibleMagic, genres: genres },
          meta: {
            basePrice: { purchase: 3.5 },
            thumbnail: faker.random.word(),
            categories: [category],
          },
        },
      );
      let albumProductId;
      let albumName = product.meta.name;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });
      await request(app)
        .get(`/products/${albumProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals(albumName);
          expect(response.body.meta.genres.sort()).deep.equals(
            ['pop', 'Latin'].sort(),
          );
          expect(response.body.source.genres.sort()).deep.equals(genres.sort());
        });
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product1)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });

      albumName = product1.meta.name;
      await request(app)
        .get(`/products/${albumProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(3.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals(albumName);
          expect(response.body.meta.genres.sort()).deep.equals(
            ['pop', 'Latin'].sort(),
          );
          expect(response.body.source.genres.sort()).deep.equals(genres.sort());
        });
      await request(app)
        .get('/distinctProductValues?fieldPath=meta.genres')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data.length).equals(3);
        });
      await request(app)
        .get('/distinctProductValues?fieldPath=meta.basePrice.purchase')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data.length).equals(2);
        });
      return request(app)
        .get('/distinctProductValues?fieldPath=meta.categories')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data.length).equals(1);
        });
    });
    it('creates an ebook product', async () => {
      const productSchema = await productTypeMan.getProductType('ebook');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      let productId;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId = response.body.productId;
        });
      return request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
    });
    it('creates an ebook subscription product', async () => {
      const productSchema =
        await productTypeMan.getProductType('ebookSubscription');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      let productId;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId = response.body.productId;
        });
      return request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
    });
  });
  describe('updateProduct', () => {
    it('gets a 404 for productType', async () => {
      const product = ModelFactory.product({ productTypeId: 'bicycle' });
      return request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(404)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `No ProductType found matching { productTypeId: 'bicycle' }`,
          );
        });
    });
    it('gets a 404 for product', async () => {
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      return request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(404)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `No Product found matching { productId: ${product.productId} }`,
          );
        });
    });
    it('gets a 400 for product id mismatch', async () => {
      const product = ModelFactory.product({ productTypeId: 'bicycle' });
      return request(app)
        .put(`/products/123`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(400)
        .then((response) => {
          assert.equal(
            response.body.errors[0],
            `Update productId 123 does not equal product payload id ${product.productId}`,
          );
        });
    });
    it('gets a 400 for apk when the meta.category value is not in lower case', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('apk');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { category: 'apk' },
        source: { vendorName: 'APK Vendor' },
      });

      product.productId = await productMan.createProduct(product, { corpJwt });
      const updatedProduct = _.merge(product, { meta: { category: 'aPk' } });
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(updatedProduct)
        .expect(400);
    });
    it('allow update for apk when the meta.category value is in lower case', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('apk');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { category: 'appk' },
        source: { vendorName: 'APK Vendor' },
      });

      product.productId = await productMan.createProduct(product, { corpJwt });
      const updatedProduct = _.merge(product, { meta: { category: 'apk' } });
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(updatedProduct)
        .expect(204);
      return request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          return expect(response.body.meta.category).to.equal('apk');
        });
    });
    it('gets a 409 for version mismatch error', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      product.productId = await productMan.createProduct(product, { corpJwt });
      const expectedProduct = _.merge(product, {
        version: 2,
        meta: { name: 'foobar' },
      });
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(expectedProduct)
        .expect(409);
    });
    it('updates a product with versions', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      product.productId = await productMan.createProduct(product, { corpJwt });
      const expectedProduct = _.merge(product, {
        version: 0,
        available: true,
        meta: { name: 'foobar', effectivePrice: { rental: 1.5 } },
        isBlocked: false,
      });
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(expectedProduct)
        .expect(204);
      expectedProduct.version = 2;
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(expectedProduct)
        .expect(204);
      expectedProduct.version = 3;
      return request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          return expect(
            _.omit(response.body, ['cdate', 'udate']),
          ).to.deep.equal(
            _.omit(
              {
                ...expectedProduct,
                purchaseOptions: [],
                subscriptionIds: [],
                available: false,
              },
              // Omit meta.effectivePrice as it shouldn't be saved when updating product
              ['cdate', 'udate', 'meta.effectivePrice'],
            ),
          );
        });
    });
    it('does not allow setting a product to active when it is missing required data', async () => {
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema);
      const {
        body: { productId },
      } = await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(product)
        .expect(200);
      const updatedProduct = {
        ...product,
        productId,
        status: ProductStatus.Active,
      };
      const { body } = await request(app)
        .put(`/products/${productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(updatedProduct)
        .expect(400);
      expect(body.errors[0].message).to.include(
        `required when product status is '${ProductStatus.Active}'`,
      );
    });
    it('updates a music album product with art approved', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('album');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic },
        meta: { basePrice: { purchase: 1.5 } },
      });
      let albumProductId;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });
      product.productId = albumProductId;
      const expectedProduct = _.merge(product, {
        version: 0,
        cache: true,
        available: true,
        meta: { name: 'foobar', thumbnail: 'someURL' },
      });

      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(expectedProduct)
        .expect(204);

      await request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals('foobar');
          expect(response.body.meta.thumbnail).equals('someURL');
          expect(response.body.meta.thumbnailApproved).equals(
            ThumbnailApprovedStatus.Pending,
          );
        });
      expectedProduct.version = 2;
      expectedProduct.meta.thumbnailApproved = ThumbnailApprovedStatus.Approved;
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(expectedProduct)
        .expect(204);

      await request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals('foobar');
          expect(response.body.meta.thumbnail).equals('someURL');
          expect(response.body.meta.thumbnailApproved).equals(
            ThumbnailApprovedStatus.Approved,
          );
        });
    });
    it('updates a music album product with source.genre to meta.genre and vice versa', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('album');
      const distinctProductValueDao = new DistinctProductValueDao();
      const genres: string[] = [faker.random.arrayElement(['pop', 'rock'])];
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        source: { vendorName: VendorNames.AudibleMagic },
        meta: { basePrice: { purchase: 1.5 }, genres: ['random'] },
      });
      let albumProductId;

      await distinctProductValueDao.createAndRetrieve(
        ModelFactory.distinctProductValue({
          sourceValueName: 'hip',
          fieldPath: DistinctProductFieldPath.Genres,
          productTypeGroupId: 'music',
          displayName: 'hiphop',
        }),
        {},
      );

      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(product)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          albumProductId = response.body.productId;
        });
      product.productId = albumProductId;

      await request(app)
        .get(`/products/${albumProductId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.source.genres).deep.equals(['random']);
        });

      const expectedProduct = _.merge(product, {
        version: 0,
        cache: true,
        available: true,
        meta: { name: 'foobar', thumbnail: 'someURL', genres: genres },
      });

      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(expectedProduct)
        .expect(204);

      await request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals('foobar');
          expect(response.body.meta.genres).deep.equals(genres);
          expect(response.body.source.genres).deep.equals(genres);
        });
      expectedProduct.version = 2;
      expectedProduct.meta.genres = ['random'];
      expectedProduct.source.genres = genres;

      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(expectedProduct)
        .expect(204);

      await distinctProductValueDao.createAndRetrieve(
        ModelFactory.distinctProductValue({
          sourceValueName: 'hop',
          fieldPath: DistinctProductFieldPath.Genres,
          productTypeGroupId: 'music',
          displayName: 'hiphop',
        }),
        {},
      );

      await request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals('foobar');
          expect(response.body.meta.genres).deep.equals(genres);
          expect(response.body.source.genres).deep.equals(genres);
        });

      expectedProduct.version = 3;
      expectedProduct.meta.genres = ['bla'];
      expectedProduct.meta.name = 'foobar 2';
      expectedProduct.source.genres = [
        'hip',
        'hop',
        'latin-hiphop',
        'HIP',
        'HOP',
      ];

      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(expectedProduct)
        .expect(204);

      return request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.basePrice.purchase).equals(1.5);
          expect(response.body.source.vendorName).equals(
            VendorNames.AudibleMagic,
          );
          expect(response.body.meta.name).equals('foobar 2');
          expect(response.body.meta.genres.sort()).deep.equals(
            ['hiphop', 'latin-hiphop'].sort(),
          );
          expect(response.body.source.genres.sort()).deep.equals(
            ['hip', 'hop', 'latin-hiphop', 'HIP', 'HOP'].sort(),
          );
        });
    });
    it('updates a manually blocked product and check that it still blocked even if there are no matching terms or blocked parents', async () => {
      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('track');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        isManuallyBlocked: true,
      });
      product.productId = await productMan.createProduct(product, { corpJwt });
      const expectedProduct = _.merge(product, {
        version: 0,
        cache: true,
        available: true,
        meta: { name: 'foobar', thumbnail: 'someURL' },
        isBlocked: true,
      });
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(expectedProduct)
        .expect(204);

      await request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.meta.name).equals('foobar');
          expect(response.body.isBlocked).equals(true);
        });
    });
    it('update not manually blocked product and drop the isBlocked flag if no more reason to block it', async () => {
      // add block term
      const productTypeGroupId = 'music';
      const term = ModelFactory.blocklistTerm({
        productTypeGroupId,
        term: 'test',
      });
      await blocklistTermDao.createAndRetrieve(term, {
        apiKey: 'integration-test',
      });

      const corpJwt = SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testy',
        permissions: ['catalogAdmin'],
      });
      const actualJwt = await SecurityFactory.jwt(corpJwt);
      const productSchema = await productTypeMan.getProductType('track');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        meta: { name: 'foobar test' },
        productTypeGroupId,
        isManuallyBlocked: false,
      });
      product.productId = await productMan.createProduct(product, { corpJwt });

      // rename so it's unblocked now
      const expectedProduct = _.merge(product, {
        meta: { name: 'foobar' },
        version: 0,
      });
      await request(app)
        .put(`/products/${product.productId}`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .set('Authorization', `Bearer ${actualJwt}`)
        .send(expectedProduct)
        .expect(204);

      await request(app)
        .get(`/products/${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.isBlocked).equals(false);
        });

      // check that the block reason is disabled
      await request(app)
        .get(`/blockReasons?productId=${product.productId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data[0].isActive).equals(false);
        });
    });
  });
  describe('getSignedProduct', () => {
    beforeEach(async () => {
      await IntegrationTestSuite.enableProductTypes(
        ['movie', 'accessory', 'album', 'track'],
        [{ customerId: '1' }],
      );
    });
    it('returns a valid jwt', async () => {
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'VIDEO',
        meta: { basePrice: { rental: 10.88 } },
      } as any as Product);
      product.productId = await productDao.create(product, { apiKey: 'test' });
      await request(app)
        .get(`/products/${product.productId}/rental`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200)
        .then((response) => {
          const token = jwt.decode(response.text);
          expect(_.keys(token)).to.include.members([
            'customerId',
            'inmateId',
            'purchaseType',
            'purchaseCode',
            'product',
            'iat',
            'exp',
          ]);
        });
    });
    it('returns a valid jwt with fulfillmentType and multiSubscription if available', async () => {
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      const productSchema = await productTypeMan.getProductType('accessory');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'ACCESSORY',
        meta: { basePrice: { purchase: 10.88 }, multipleSubscription: true },
      } as any as Product);
      product.productId = await productDao.create(product, { apiKey: 'test' });
      await request(app)
        .get(`/products/${product.productId}/purchase`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200)
        .then((response) => {
          const token = jwt.decode(response.text);
          expect(_.keys(token)).to.include.members([
            'customerId',
            'inmateId',
            'purchaseType',
            'purchaseCode',
            'product',
            'iat',
            'exp',
          ]);
          expect(_.get(token, 'product.fulfillmentType')).to.not.be.undefined;
          expect(_.get(token, 'product.multipleSubscription')).to.be.true;
        });
    });
    it('returns a valid jwt with includedProductIds if available', async () => {
      const productSchema = await productTypeMan.getProductType('accessory');
      const childProduct1 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'ACCESSORY',
          meta: { basePrice: { purchase: 10.88 } },
          childProductIds: [],
        } as any as Product,
      );
      const childProduct2 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'ACCESSORY',
          meta: { basePrice: { purchase: 10.88 } },
          childProductIds: [],
        } as any as Product,
      );
      const products = await IntegrationTestSuite.loadProductsAndRules([
        childProduct1,
        childProduct2,
      ]);
      const productChildIds = _.map(
        products,
        (childProduct) => childProduct.productId,
      );
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'ACCESSORY',
        meta: { basePrice: { purchase: 10.88 } },
        childProductIds: productChildIds,
      } as any as Product);

      product.productId = await productDao.create(product, { apiKey: 'test' });
      await request(app)
        .get(`/products/${product.productId}/purchase`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200)
        .then((response) => {
          const token = jwt.decode(response.text);
          expect(_.keys(token)).to.include.members([
            'customerId',
            'inmateId',
            'purchaseType',
            'purchaseCode',
            'product',
            'iat',
            'exp',
          ]);
          expect(_.get(token, 'product.includedProductIds')).to.not.be
            .undefined;
          expect(_.get(token, 'product.includedProductIds')).to.deep.equal(
            productChildIds,
          );
          expect(_.get(token, 'product.childProductIds')).to.be.undefined;
        });
    });
    it('returns a valid jwt with only available products in includedProductIds for inmate', async () => {
      const productSchema = await productTypeMan.getProductType('accessory');
      const productGameSchema = await productTypeMan.getProductType('game');
      const childProduct1 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'ACCESSORY',
          meta: { basePrice: { purchase: 10.88 } },
          childProductIds: [],
        } as any as Product,
      );
      const childProduct2 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'ACCESSORY',
          meta: { basePrice: { purchase: 10.88 } },
          childProductIds: [],
        } as any as Product,
      );
      const childProduct3 = ModelFactory.productFromSchema(
        productGameSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'GAME',
          meta: { basePrice: { purchase: 10.88 } },
          childProductIds: [],
        } as any as Product,
      );
      const rule = ModelFactory.productAvailabilityRule({
        action: { available: false },
        productTypeId: 'game',
        customerId: '1',
      });
      const products = await IntegrationTestSuite.loadProductsAndRules(
        [childProduct1, childProduct2, childProduct3],
        [rule],
      );
      const productChildIds = _.map(
        products,
        (childProduct) => childProduct.productId,
      );
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'ACCESSORY',
        meta: { basePrice: { purchase: 10.88 } },
        childProductIds: productChildIds,
      } as any as Product);

      product.productId = await productDao.create(product, { apiKey: 'test' });
      await request(app)
        .get(`/products/${product.productId}/purchase`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200)
        .then((response) => {
          const token = jwt.decode(response.text);
          expect(_.keys(token)).to.include.members([
            'customerId',
            'inmateId',
            'purchaseType',
            'purchaseCode',
            'product',
            'iat',
            'exp',
          ]);
          expect(_.get(token, 'product.includedProductIds')).to.not.be
            .undefined;
          expect(_.get(token, 'product.includedProductIds')).to.deep.equal(
            productChildIds.slice(0, 2),
          );
          expect(_.get(token, 'product.childProductIds')).to.be.undefined;
        });
    });
    it('returns a 400 when parent product does not contain child products', async () => {
      const productSchema = await productTypeMan.getProductType('accessory');
      const productGameSchema = await productTypeMan.getProductType('game');
      const childProduct = ModelFactory.productFromSchema(
        productGameSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'GAME',
          meta: { basePrice: { purchase: 10.88 } },
          childProductIds: [],
        } as any as Product,
      );
      const rule = ModelFactory.productAvailabilityRule({
        action: { available: false },
        productTypeId: 'game',
        customerId: '1',
      });
      const products = await IntegrationTestSuite.loadProductsAndRules(
        [childProduct],
        [rule],
      );
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );

      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'ACCESSORY',
        meta: { basePrice: { purchase: 10.88 } },
        childProductIds: [products[0].productId],
      } as any as Product);

      product.productId = await productDao.create(product, { apiKey: 'test' });
      await request(app)
        .get(`/products/${product.productId}/purchase`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);
    });
    it('returns a 404 for product not found', async () => {
      const inmateJwt = await SecurityFactory.jwt(SecurityFactory.inmateJwt());
      await request(app)
        .get(`/products/123/rental`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(404);
    });
    it('returns 400 for invalid purchase type', async () => {
      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      const productSchema = await productTypeMan.getProductType('movie');
      const product = ModelFactory.productFromSchema(productSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'VIDEO',
        meta: { basePrice: { rental: 10.88 } },
      } as any as Product);
      product.productId = await productDao.create(product, { apiKey: 'test' });
      await request(app)
        .get(`/products/${product.productId}/purchase`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(400);
    });
    it('throws error for invalid album purchase when local media enforced', async () => {
      const appConfig = Container.get(AppConfig);
      const appConfigGetStub = sinon.stub(appConfig as any, 'get');

      const inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      appConfigGetStub
        .withArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      const trackSchema = await productTypeMan.getProductType('track');
      const track = ModelFactory.productFromSchema(trackSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'MUSIC',
        meta: { basePrice: { purchase: 10.88 } },
        childProductsIds: [],
      } as any as Product);
      track.productId = await productDao.create(track, { apiKey: 'test' });

      const albumSchema = await productTypeMan.getProductType('album');

      const album = ModelFactory.productFromSchema(albumSchema.jsonSchema, {
        status: ProductStatus.Active,
        purchaseCode: 'MUSIC',
        meta: { basePrice: { purchase: 10.88 } },
        childProductIds: [track.productId],
      } as any as Product);
      album.productId = await productDao.create(album, { apiKey: 'test' });

      await request(app)
        .get(`/products/${album.productId}/purchase`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(400);
    });
  });

  describe('searchProductsBySubscription', () => {
    let movieSchema: SpLite;
    let gameSchema: SpLite;
    let albumSchema: SpLite;

    beforeEach(async () => {
      movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
      gameSchema = (await productTypeDao.findOneOrFail('game')).jsonSchema;
      albumSchema = (await productTypeDao.findOneOrFail('album')).jsonSchema;
    });

    describe('search Products By Subscribed ProductId with 400, 404 or empty results', () => {
      beforeEach(async () => {
        const productTypeGameSubscriptionSchema =
          await productTypeMan.getProductType('gameSubscription');

        const products = [
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Gone with the wind',
              description: 'i actually have never seen this',
              rating: 'PG',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(gameSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'It Game1',
              description: 'cards game',
              rating: 'R',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
        ];

        await IntegrationTestSuite.loadProductsAndRules(
          products,
          [],
          [{ customerId: '1' }, { customerId: '1', siteId: '2' }],
          ['movie', 'tvShow', 'game', 'gameSubscription'],
        );

        const productGameSubscription = ModelFactory.productFromSchema(
          productTypeGameSubscriptionSchema.jsonSchema,
          {
            meta: {
              basePrice: { subscription: 8.99 },
              description: 'Game Subscription',
              billingInterval: {
                count: 1,
                interval: 'months',
              },
            },
            fulfillmentType: 'digital',
            status: 'Active',
            purchaseTypes: ['subscription'],
            source: { vendorName: 'Game Vendor' },
          },
        );

        productIdOfGameSubscription = await productMan.createProduct(
          productGameSubscription,
          { apiKey: 'test' },
        );
      });

      it('gets a 404 when product id do not exist', async () => {
        return request(app)
          .post(`/products/123456/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(404);
      });
      it('searches with the empty search with no whitelist rule, should result in empty result set', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200);

        expect(body.data.length).to.equal(0);
      });
      it('searches with the both query and match should result in 400', async () => {
        const search = {
          term: 'scary',
          match: {
            meta: { rating: 'r' },
          },
          query: {
            productTypeId: 'movie',
            clauses: {
              'meta.rating': ['R', 'PG-13'],
            },
          },
        };
        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send(search)
          .expect(400);
      });
      it('searches with the empty search should retrieve 0 products with enforce - true', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true } })
          .expect(200);

        expect(body.data.length).to.equal(0);
      });
    });
    describe('search products By Subscribed ProductId with all products whitelisted', () => {
      beforeEach(async () => {
        const productTypeGameSubscriptionSchema =
          await productTypeMan.getProductType('gameSubscription');

        const products = [
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Gone with the wind',
              description: 'i actually have never seen this',
              rating: 'PG',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
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
          ModelFactory.productFromSchema(gameSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'It Game1',
              description: 'cards game',
              rating: 'R',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(gameSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Clown',
              description: 'clown description',
              rating: 'AO',
              basePrice: {
                rental: 9.99,
              },
            },
          } as any),
        ];

        await IntegrationTestSuite.loadProductsAndRules(
          products,
          [],
          [{ customerId: '1' }, { customerId: '1', siteId: '2' }],
          ['movie', 'game', 'gameSubscription'],
        );

        const productGameSubscription = ModelFactory.productFromSchema(
          productTypeGameSubscriptionSchema.jsonSchema,
          {
            meta: {
              basePrice: { subscription: 8.99 },
              description: 'Game Subscription',
              billingInterval: {
                count: 1,
                interval: 'months',
              },
            },
            fulfillmentType: 'digital',
            status: 'Active',
            purchaseTypes: ['subscription'],
            source: { vendorName: 'Game Vendor' },
          },
        );

        productIdOfGameSubscription = await productMan.createProduct(
          productGameSubscription,
          { apiKey: 'test' },
        );

        const product2GameSubscription = ModelFactory.productFromSchema(
          productTypeGameSubscriptionSchema.jsonSchema,
          {
            meta: {
              basePrice: { subscription: 9.99 },
              description: 'Game 2 Subscription',
              billingInterval: {
                count: 1,
                interval: 'months',
              },
            },
            fulfillmentType: 'digital',
            status: 'Active',
            purchaseTypes: ['subscription'],
            source: { vendorName: 'Game Vendor' },
          },
        );

        productId2OfGameSubscription = await productMan.createProduct(
          product2GameSubscription,
          { apiKey: 'test' },
        );
        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: {},
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistSubscriptionAvailability)
          .expect(200);
      });

      it('searches with the term not matching any game product name, retrieve 0 products', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ term: 'scary' })
          .expect(200);

        expect(body.data.length).to.equal(0);
      });
      it('searches with the term matching game meta.name retrieve 1 product', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ term: 'It' })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['It Game1']);
      });
      it('search with the query and filters out products, should retrieve 1 products', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'it',
            query: {
              productTypeId: 'game',
              clauses: {
                'meta.rating': ['R'],
              },
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['It Game1']);
      });
      it('search with the empty match, should retrieve 2 products', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ match: {} })
          .expect(200);

        expect(body.data.length).to.equal(2);
        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'It Game1',
          'Clown',
        ]);
      });
      it('search with the empty match with no productTypeId, should retrieve 1 products', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              meta: { rating: 'AO' },
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['Clown']);
      });
      it('search with the match with some other productTypeId, rather than the productTypeId of the product in the request, should retrieve 0 products of movie', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'movie',
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(0);
      });
      it('search with the match with some other productTypeId and game ratings, should retrieve only 1 product of game', async () => {
        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: [{ productTypeId: 'movie' }, { meta: { rating: 'AO' } }],
          })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['Clown']);
      });
      it('should return 0 products when no whitelist rules exist for the productId in the request url, but a whitelist rule exists for a different subscription productId', async () => {
        const { body } = await request(app)
          .post(`/products/${productId2OfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'it',
            query: {
              productTypeId: 'game',
              clauses: {
                'meta.rating': ['R'],
              },
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(0);
      });
    });
    describe('productSearch and/or searchProductsBySubscription applying rules for ProductAvailability and/or ProductSubscriptionAvailability', () => {
      beforeEach(async () => {
        const productTypeGameSubscriptionSchema =
          await productTypeMan.getProductType('gameSubscription');

        const products = [
          ModelFactory.productFromSchema(movieSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Gone with the wind',
              description: 'i actually have never seen this',
              rating: 'PG',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
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
          ModelFactory.productFromSchema(gameSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'It Game1',
              description: 'cards game',
              rating: 'R',
              basePrice: {
                rental: 5.99,
              },
            },
          } as any),
          ModelFactory.productFromSchema(gameSchema, {
            status: ProductStatus.Active,
            meta: {
              name: 'Clown',
              description: 'clown description',
              rating: 'AO',
              basePrice: {
                rental: 9.99,
              },
            },
          } as any),
        ];

        await IntegrationTestSuite.loadProductsAndRules(
          products,
          [],
          [{ customerId: '1' }, { customerId: '1', siteId: '2' }],
          ['movie', 'game', 'gameSubscription'],
        );

        const productGameSubscription = ModelFactory.productFromSchema(
          productTypeGameSubscriptionSchema.jsonSchema,
          {
            meta: {
              basePrice: { subscription: 8.99 },
              description: 'Game Subscription',
              billingInterval: {
                count: 1,
                interval: 'months',
              },
            },
            fulfillmentType: 'digital',
            status: 'Active',
            purchaseTypes: ['subscription'],
            source: { vendorName: 'Game Vendor' },
          },
        );

        productIdOfGameSubscription = await productMan.createProduct(
          productGameSubscription,
          { apiKey: 'test' },
        );
        const product2GameSubscription = ModelFactory.productFromSchema(
          productTypeGameSubscriptionSchema.jsonSchema,
          {
            meta: {
              basePrice: { subscription: 8.99 },
              description: 'Game 2 Subscription',
              billingInterval: {
                count: 1,
                interval: 'months',
              },
            },
            fulfillmentType: 'digital',
            status: 'Active',
            purchaseTypes: ['subscription'],
            source: { vendorName: 'Game Vendor' },
          },
        );
        productId2OfGameSubscription = await productMan.createProduct(
          product2GameSubscription,
          { apiKey: 'test' },
        );
      });

      // blacklist with product_availability for one game product
      // white list all product_subscription_availability
      // subscription search with empty or context.enforce = true, should return the whitelisted product_subscription_availability
      // subscription search with empty or context.enforce = true fora different subscriptionProductId, should return no products
      // product search with context.enforce = true, should not return the blacklisted product_availability
      it('blacklist product_availability and whitelist subscription_availability, expect whitelisted, expectations/steps in comments', async () => {
        const blackListAvailability = ModelFactory.gameAvailabilityRule({
          customerId: '1',
          siteId: '2',
          action: { available: false },
          clauses: { 'meta.name': ['Clown'] },
        });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(blackListAvailability)
          .expect(200);

        const whitelistAllSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: {},
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistAllSubscriptionAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200);

        expect(body.data.length).to.equal(2);
        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'It Game1',
          'Clown',
        ]);

        await request(app)
          .post(`/products/${productId2OfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(0);
          });

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(1);
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(3);
          });
      });

      // blacklist with product_availability for one game product
      // subscription search with or without context should not expect any products
      // product search with context.enforce = true, should not expect the blacklisted product_availability
      it('blacklist Product availability and invoke product and subscription search, expectation/steps in comments', async () => {
        const blacklistAvailability = ModelFactory.gameAvailabilityRule({
          customerId: '1',
          siteId: '2',
          action: { available: false },
          clauses: { 'meta.name': ['Clown'] },
        });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(blacklistAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200);

        expect(body.data.length).to.equal(0);

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(0);
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(3);
          });
      });

      // whitelist with product_subscription_availability for one game product
      // subscription search with or without context should expect only the whitelisted product
      // product search with context.enforce = true, should expect all the products
      // blacklist with same game product_subscription_availability
      // subscription search without context should not expect the whitelisted product any more.
      // product search with context.enforce = true, should expect all the products
      it('whitelist Product subscription availability then blacklist same product, expectations/steps in comments', async () => {
        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: { 'meta.name': ['Clown'] },
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistSubscriptionAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['Clown']);

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(1);
            expect(_.map(body.data, 'meta.name')).to.deep.equal(['Clown']);
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(4);
          });

        const blackListSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: false },
            clauses: { 'meta.name': ['Clown'] },
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(blackListSubscriptionAvailability)
          .expect(200);

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true } })
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(0);
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(4);
            expect(
              _.map(
                response.body.data.filter(
                  ({ productTypeId }) =>
                    productTypeId === 'game' || productTypeId === 'movie',
                ),
                'meta.name',
              ).sort(),
            ).to.deep.equal(
              ['Gone with the wind', 'It', 'It Game1', 'Clown'].sort(),
            );
          });
      });

      // blacklist with product_availability for one game product
      // subscription search with or without context should not expect any product
      // product search with context.enforce = true, should expect all other products other than blacklisted
      // whitelist with same game product_availability
      // subscription search without context should not expect any product.
      // product search with context.enforce = true, should expect all the products along with the blacklisted
      it('blacklist product availability and then whitelist product availability and product not to be part of search, expectations/steps in comments', async () => {
        const blackListAvailabilityRule = ModelFactory.gameAvailabilityRule({
          customerId: '1',
          siteId: '2',
          action: { available: false },
          clauses: { 'meta.name': ['Clown'] },
        });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(blackListAvailabilityRule)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200);
        expect(body.data.length).to.equal(0);

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(3);
            expect(
              _.map(
                response.body.data.filter(
                  ({ productTypeId }) =>
                    productTypeId === 'game' || productTypeId === 'movie',
                ),
                'meta.name',
              ).sort(),
            ).to.deep.equal(['Gone with the wind', 'It', 'It Game1'].sort());
          });

        const whitelistAvailability = ModelFactory.gameAvailabilityRule({
          action: { available: true },
          clauses: { 'meta.name': ['Clown'] },
        });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistAvailability)
          .expect(200);

        // Clear the cache
        await request(app)
          .get(`/test/cache/clear`)
          .set('X-API-KEY', 'API_KEY_DEV')
          .expect(204);

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(0);
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(4);
            expect(
              _.map(
                response.body.data.filter(
                  ({ productTypeId }) =>
                    productTypeId === 'game' || productTypeId === 'movie',
                ),
                'meta.name',
              ).sort(),
            ).to.deep.equal(
              ['Gone with the wind', 'It', 'It Game1', 'Clown'].sort(),
            );
          });
      });
      it('search with the term and query and filters out products other than whitelisted product subscription availability', async () => {
        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: {},
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistSubscriptionAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            term: 'it',
            query: {
              productTypeId: 'game',
              clauses: {
                'meta.rating': ['R'],
              },
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['It Game1']);
      });
      it('search with query and filters out products other than whitelisted product subscription availability', async () => {
        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: {},
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistSubscriptionAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            query: {
              productTypeId: 'game',
              clauses: {
                'meta.rating': ['AO'],
              },
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['Clown']);
      });
      it('search with match and filters out products other than whitelisted product subscription availability', async () => {
        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: {},
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistSubscriptionAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              meta: { rating: 'AO' },
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(1);
        expect(_.map(body.data, 'meta.name')).to.deep.equal(['Clown']);
      });
      // whitelist with product_availability for all the game product.
      // whitelist with product_subscription_availability for all the game product.
      // subscription search with or without context should expect only the whitelisted product.
      // product search with context.enforce = true, should expect all the products.
      // blacklist one game product_subscription_availability.
      // subscription search without context should not expect the blacklisted product any more.
      // product search with context.enforce = true, should expect all the products.
      it('whitelist Product subscription availability then blacklist same product, white list product availability, expectations/steps in comments', async () => {
        const whitelistAvailability = ModelFactory.productAvailabilityRule({
          productTypeId: 'game',
          action: { available: true },
          clauses: {},
        });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistAvailability)
          .expect(200);

        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: true },
            clauses: {},
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(whitelistSubscriptionAvailability)
          .expect(200);

        const { body } = await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200);

        expect(body.data.length).to.equal(2);
        expect(_.map(body.data, 'meta.name')).to.deep.equal([
          'It Game1',
          'Clown',
        ]);

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(2);
            expect(_.map(body.data, 'meta.name').sort()).to.deep.equal(
              ['It Game1', 'Clown'].sort(),
            );
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(4);
          });

        const blackListSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'game',
            action: { available: false },
            clauses: { 'meta.name': ['Clown'] },
            productId: productIdOfGameSubscription,
          });
        await request(app)
          .post('/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send(blackListSubscriptionAvailability)
          .expect(200);

        // Clear the cache
        await request(app)
          .get(`/test/cache/clear`)
          .set('X-API-KEY', 'API_KEY_DEV')
          .expect(204);

        await request(app)
          .post(`/products/${productIdOfGameSubscription}/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({})
          .expect(200)
          .then((response) => {
            expect(response.body.data.length).to.equal(1);
            expect(_.map(response.body.data, 'meta.name')).to.deep.equal([
              'It Game1',
            ]);
          });

        await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ context: { enforce: true, customerId: '1', siteId: '2' } })
          .expect(200)
          .then((response) => {
            expect(
              response.body.data.filter(
                ({ productTypeId }) =>
                  productTypeId === 'game' || productTypeId === 'movie',
              ).length,
            ).to.equal(4);
            expect(
              _.map(
                response.body.data.filter(
                  ({ productTypeId }) =>
                    productTypeId === 'game' || productTypeId === 'movie',
                ),
                'meta.name',
              ).sort(),
            ).to.deep.equal(
              ['Gone with the wind', 'It', 'It Game1', 'Clown'].sort(),
            );
          });
      });
    });
    describe('search products should not include purchaseOptions based on purchase and subscription availability', () => {
      beforeEach(async () => {
        const productTypeMusicSubscriptionSchema =
          await productTypeMan.getProductType('musicSubscription');

        const products = [
          ModelFactory.productFromSchema(albumSchema, {
            status: ProductStatus.Active,
            meta: {
              name: faker.random.word(),
              description: faker.random.words(10),
              rating: 'PG',
              basePrice: {
                rental: 5.99,
              },
            },
            source: {
              availableForPurchase: false,
              availableForSubscription: false,
            },
          } as any),
          ModelFactory.productFromSchema(albumSchema, {
            status: ProductStatus.Active,
            meta: {
              name: faker.random.word(),
              description: faker.random.words(10),
              rating: 'R',
              basePrice: {
                rental: 5.99,
              },
            },
            source: {
              availableForPurchase: false,
              availableForSubscription: true,
            },
          } as any),
          ModelFactory.productFromSchema(albumSchema, {
            status: ProductStatus.Active,
            meta: {
              name: faker.random.word(),
              description: faker.random.words(10),
              rating: 'R',
              basePrice: {
                rental: 5.99,
              },
            },
            source: {
              availableForPurchase: true,
              availableForSubscription: true,
            },
          } as any),
          ModelFactory.productFromSchema(albumSchema, {
            status: ProductStatus.Active,
            meta: {
              name: faker.random.word(),
              description: faker.random.words(10),
              rating: 'AO',
              basePrice: {
                rental: 9.99,
              },
            },
            source: {
              availableForPurchase: true,
              availableForSubscription: false,
            },
          } as any),
        ];

        await IntegrationTestSuite.enableProductTypes(
          ['album', 'musicSubscription'],
          [
            { customerId: '1' },
            {
              customerId: '1',
              siteId: '2',
            },
          ],
        );
        for (const product of products) {
          await productDao.create(product, { apiKey: 'test' });
        }

        const productMusicSubscription = ModelFactory.productFromSchema(
          productTypeMusicSubscriptionSchema.jsonSchema,
          {
            meta: {
              basePrice: { subscription: 8.99 },
              description: 'Gold Subscription',
              billPeriodDays: 30,
            },
            fulfillmentType: 'digital',
            status: 'Active',
            purchaseTypes: ['subscription'],
            source: { vendorName: 'Music Vendor' },
          },
        );

        const subscriptionId = await productMan.createProduct(
          productMusicSubscription,
          { apiKey: 'test' },
        );
        const whitelistSubscriptionAvailability =
          ModelFactory.productSubscriptionAvailability({
            productTypeId: 'album',
            action: { available: true },
            clauses: {},
            productId: subscriptionId,
          });
        await request(app)
          .post('/rules')
          .set('x-api-key', 'API_KEY_DEV')
          .send(whitelistSubscriptionAvailability)
          .expect(200);

        await request(app)
          .post('/digest/products/album')
          .set('x-api-key', 'API_KEY_DEV')
          .expect(200);
      });

      it('search subscription products, to return purchaseOptions', async () => {
        await Bluebird.delay(1000);
        const { body } = await request(app)
          .post(`/products/search`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            match: {
              productTypeId: 'album',
            },
          })
          .expect(200);

        expect(body.data.length).to.equal(4);
        expect(body.data[0].purchaseOptions.length).to.equal(1);
        expect(body.data[1].purchaseOptions.length).to.equal(1);
        expect(body.data[2].purchaseOptions.length).to.equal(2);
        expect(body.data[3].purchaseOptions.length).to.equal(2);
        assert.deepEqual(body.data[0].purchaseOptions[0], {
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
        assert.deepEqual(body.data[1].purchaseOptions[0], {
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
        expect(body.data[2].purchaseOptions[0].type).to.equal('rental');
        expect(body.data[3].purchaseOptions[0].type).to.equal('rental');
      });
    });
  });

  describe('getSignedMemberProduct', () => {
    let inmateJwt;
    let subscriptionSchema;
    let memberProductSchema;
    let subscriptionProduct;
    let memberProduct;

    beforeEach(async () => {
      await IntegrationTestSuite.enableProductTypes(
        ['game', 'gameSubscription'],
        [{ customerId: '1' }],
      );
      inmateJwt = await SecurityFactory.jwt(
        SecurityFactory.inmateJwt({ customerId: '1', siteId: '2' }),
      );
      subscriptionSchema =
        await productTypeMan.getProductType('gameSubscription');
      memberProductSchema = await productTypeMan.getProductType('game');
      subscriptionProduct = ModelFactory.productFromSchema(
        subscriptionSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'GAMESUBSCRIPTION',
          meta: { basePrice: { rental: 10.88 } },
        } as any as Product,
      );
      memberProduct = ModelFactory.productFromSchema(
        memberProductSchema.jsonSchema,
        {
          status: ProductStatus.Active,
          purchaseCode: 'GAME',
          meta: { basePrice: { subscription: 4.99 } },
        } as any as Product,
      );

      subscriptionProduct.productId = await productDao.create(
        subscriptionProduct,
        { apiKey: 'test' },
      );
      memberProduct.productId = await productDao.create(memberProduct, {
        apiKey: 'test',
      });
    });

    it('returns a valid jwt', async () => {
      const subscriptionRule = ModelFactory.productSubscriptionAvailabilityRule(
        {
          ruleId: 123,
          productId: subscriptionProduct.productId,
          productTypeId: memberProduct.productTypeId,
          action: { available: true },
        },
      );
      await ruleDao.create(subscriptionRule, { apiKey: 'test' });

      await request(app)
        .get(
          `/products/${subscriptionProduct.productId}/${memberProduct.productId}/subscription`,
        )
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200)
        .then((response) => {
          const token = jwt.decode(response.text);
          expect(_.keys(token)).to.include.members([
            'customerId',
            'inmateId',
            'purchaseType',
            'purchaseCode',
            'product',
            'iat',
            'exp',
          ]);
          expect(token).to.deep.nested.property('product.parentProductId');
        });
    });
    it('returns a 404 for product not found', async () => {
      await request(app)
        .get(`/products/123/321/subscription`)
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(404);
    });
    it('returns 400 for invalid purchase type', async () => {
      const subscriptionRule = ModelFactory.productSubscriptionAvailabilityRule(
        {
          ruleId: 123,
          productId: subscriptionProduct.productId,
          productTypeId: memberProduct.productTypeId,
          action: { available: true },
        },
      );
      await ruleDao.create(subscriptionRule, { apiKey: 'test' });
      await request(app)
        .get(
          `/products/${subscriptionProduct.productId}/${memberProduct.productId}/purchase`,
        )
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(400);
    });
  });

  describe('manualBlock', () => {
    const addArtistAlbumTrackSet = async (
      isArtistBlocked = false,
      isAlbumBlocked = false,
      isTrackBlocked = false,
    ) => {
      const artistSchema = await productTypeMan.getProductType('artist');
      const albumSchema = await productTypeMan.getProductType('album');
      const trackSchema = await productTypeMan.getProductType('track');

      const artist = ModelFactory.productFromSchema(artistSchema.jsonSchema, {
        status: ProductStatus.Active,
        isBlocked: isArtistBlocked,
        isManuallyBlocked: isArtistBlocked,
        source: {
          vendorName: 'test',
          vendorProductId: '1000',
        },
      } as any);
      artist.productId = await productDao.create(artist, context);

      const artistProductData = {
        name: artist.meta.name,
        vendorArtistId: artist.source.vendorProductId,
        role: 'main',
        vendorName: artist.source.vendorName,
        rank: '1',
        sortKey: 21,
      };

      const track = ModelFactory.productFromSchema(trackSchema.jsonSchema, {
        status: ProductStatus.Active,
        isBlocked: isTrackBlocked,
        isManuallyBlocked: false,
        source: {
          vendorName: 'test',
          vendorProductId: '100',
          vendorParentId: '1',
          vendorArtistId: artist.source.vendorProductId,
        },
        meta: {
          artists: [artistProductData],
          genres: ['rock'],
        },
      } as any);
      track.productId = await productDao.create(track, context);

      const album = ModelFactory.productFromSchema(albumSchema.jsonSchema, {
        status: ProductStatus.Active,
        isBlocked: isAlbumBlocked,
        isManuallyBlocked: isAlbumBlocked,
        childProductIds: [track.productId],
        source: {
          vendorName: 'test',
          vendorProductId: '1',
          vendorArtistId: artist.source.vendorProductId,
        },
        meta: {
          artists: [artistProductData],
          genres: ['rock'],
        },
      } as any);
      album.productId = await productDao.create(album, context);

      return { artist, album, track };
    };

    it('manually blocks artist inline and create an LIE to block related artist and track', async function () {
      const { artist, album, track } = await addArtistAlbumTrackSet();
      const artistId = artist.productId;
      await request(app)
        .post(`/products/${artistId}/manualBlock`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          manuallyBlockedReason: ManuallyBlockedReason.Explicit,
        })
        .expect(204);
      await Bluebird.delay(500);

      const updatedArtist = await productDao.findOne(artistId);
      const updatedAlbum = await productDao.findOne(album.productId);
      const updatedTrack = await productDao.findOne(track.productId);

      // check that LIE is created
      const liesCreated = await lieDao.find();
      const lieCreatedAutoReviewProduct = liesCreated.filter(
        (lie) =>
          lie.payload.productId === artistId &&
          lie.payload.type === BlockActionBy.AutoReview &&
          lie.payload.action === BlockActionType.Add,
      );

      // should block inline an then unblock child as autoreview process
      expect(updatedArtist.isManuallyBlocked).to.be.true;
      expect(updatedArtist.isBlocked).to.be.true;
      expect(lieCreatedAutoReviewProduct.length).to.equal(1);

      // related product should be just blocked
      expect(updatedAlbum.isBlocked).to.be.true;
      expect(updatedTrack.isBlocked).to.be.true;
    });

    it('manually unblock artist and check that the same "reason" was updated ro be inactive', async () => {
      const { artist } = await addArtistAlbumTrackSet();
      const artistId = artist.productId;
      await request(app)
        .post(`/products/${artistId}/manualBlock`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          manuallyBlockedReason: ManuallyBlockedReason.Explicit,
        })
        .expect(204);
      await Bluebird.delay(500);

      await request(app)
        .get(`/blockReasons?productId=${artistId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data[0].isActive).equals(true);
          expect(response.body.data.length).equals(1);
        });

      // unblock
      await request(app)
        .post(`/products/${artistId}/manualUnblock`)
        .set('Authorization', `Bearer ${testToken}`)
        .send()
        .expect(204);
      await Bluebird.delay(500);

      await request(app)
        .get(`/blockReasons?productId=${artistId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data[0].isActive).equals(false);
          expect(response.body.data.length).equals(1);
        });
    });

    it('unblocks a product', async () => {
      const { album, track } = await addArtistAlbumTrackSet(false, true);

      const albumId = album.productId;
      await request(app)
        .post(`/products/${albumId}/manualUnblock`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(204);

      const blockAction = await blockActionDao.findOneOrFail({
        by: { productId: albumId },
      });
      const updatedProduct = await productDao.findOne(blockAction.productId);
      const updatedChildProduct = await productDao.findOne(track.productId);

      const liesCreated = await lieDao.find();
      const lieCreatedAutoReviewProduct = liesCreated.filter(
        (lie) =>
          lie.payload.productId === albumId &&
          lie.payload.type === BlockActionBy.Product,
      );

      expect(blockAction.state).to.equal(BlockActionState.Applied);
      expect(updatedProduct.isManuallyBlocked).to.be.false;
      expect(updatedProduct.isBlocked).to.be.false;
      expect(updatedChildProduct.isBlocked).to.be.false;
      expect(lieCreatedAutoReviewProduct.length).to.equal(0);
    });
  });

  describe('getProductByVendor', () => {
    let movieSchema: SpLite;
    let product: Product;

    beforeEach(async () => {
      movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;

      product = ModelFactory.productFromSchema(movieSchema, {
        status: ProductStatus.Active,
        meta: {
          name: 'Gone with the wind',
          description: 'i actually have never seen this',
          rating: 'PG',
          basePrice: {
            rental: 5.99,
          },
          cast: [
            {
              name: 'cast name',
              roles: ['director', 'actor'],
            },
          ],
        },
      } as any);

      await IntegrationTestSuite.enableProductTypes(
        ['movie'],
        [{ customerId: '1' }, { customerId: '1', siteId: '2' }],
      );

      product.productId = await productDao.create(product, { apiKey: 'test' });
    });

    describe('getProductByVendor', () => {
      it('should return a product', async () => {
        const { body } = await request(app)
          .get(
            `/products/vendor?vendorName=${product.source.vendorName}&vendorProductId=${product.source.vendorProductId}&productTypeId=${product.source.productTypeId}`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);
        expect(body.productId).to.equal(product.productId);
      });

      it('should not return a product, only an error', async () => {
        const { body } = await request(app)
          .get(
            `/products/vendor?vendorName=noname&vendorProductId=${product.source.vendorProductId}&productTypeId=${product.source.productTypeId}`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .expect(404);
        expect(body.errors).to.deep.equal([
          `No product was found with Vendor Product ID = ${product.source.vendorProductId}`,
        ]);
      });
    });
  });

  describe('republish', () => {
    it('retrieves a product and publishes a message', async () => {
      const productSchema = await productTypeMan.getProductType('movie');
      const repubProduct = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        { meta: { effectivePrice: { rental: 1.5 } } },
      );

      let productId;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(repubProduct)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId = response.body.productId;
        });
      return request(app)
        .get(`/products/republish?productId=${productId}&productTypeId=movie`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(_.keys(response.body.success[0])).to.have.members([
            'productId',
            'productTypeId',
            'productTypeGroupId',
          ]);
          expect(response.body.success[0].productId).to.equal(productId);
          expect(response.body.success[0].productTypeId).to.equal(
            repubProduct.productTypeId,
          );
          expect(response.body.success[0].productTypeGroupId).to.equal(
            repubProduct.productTypeGroupId,
          );
        });
    });
    it('retrieves multiple products and publishes messages', async () => {
      const productSchema = await productTypeMan.getProductType('game');
      const productSchema2 = await productTypeMan.getProductType('track');
      const repubProduct1 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        { meta: { effectivePrice: { rental: 1.5 } } },
      );
      const repubProduct2 = ModelFactory.productFromSchema(
        productSchema.jsonSchema,
        { meta: { effectivePrice: { rental: 1.5 } } },
      );
      const repubProduct3 = ModelFactory.productFromSchema(
        productSchema2.jsonSchema,
        { meta: { effectivePrice: { rental: 1.5 } } },
      );

      let productId1;
      let productId2;
      let productId3;
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(repubProduct1)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId1 = response.body.productId;
        });
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(repubProduct2)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId2 = response.body.productId;
        });
      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(repubProduct3)
        .expect(200)
        .then((response) => {
          assert.isNumber(
            response.body.productId,
            'Did not get back a product ID',
          );
          productId3 = response.body.productId;
        });
      await request(app)
        .get(`/products/republish?productTypeId=game`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(_.keys(response.body.success[0])).to.have.members([
            'productId',
            'productTypeId',
            'productTypeGroupId',
          ]);
          expect(response.body.success[0].productId).to.be.oneOf([
            productId1,
            productId2,
          ]);
          expect(response.body.success[0].productTypeId).to.equal(
            repubProduct2.productTypeId,
          );
          expect(response.body.success[0].productTypeGroupId).to.equal(
            repubProduct2.productTypeGroupId,
          );
          expect(_.keys(response.body.success[1])).to.have.members([
            'productId',
            'productTypeId',
            'productTypeGroupId',
          ]);
          expect(response.body.success[1].productId).to.be.oneOf([
            productId1,
            productId2,
          ]);
          expect(response.body.success[1].productTypeId).to.equal(
            repubProduct2.productTypeId,
          );
          expect(response.body.success[1].productTypeGroupId).to.equal(
            repubProduct2.productTypeGroupId,
          );
        });
      return request(app)
        .get(`/products/republish?productId=${productId3}&productTypeId=game`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200)
        .then((response) => {
          expect(_.keys(response.body.success[0])).to.not.have.members([
            'productId',
            'productTypeId',
            'productTypeGroupId',
          ]);
        });
    });
  });

  describe('Manually Reload Music Sample', () => {
    let appConfig: AppConfig;
    let appConfigGetStub: sinon.SinonStub;

    beforeEach(async () => {
      appConfig = Container.get(AppConfig);
      appConfigGetStub = sinon.stub(appConfig as any, 'get');
    });

    it('return 404 if specified product does not exist', async () => {
      await request(app)
        .post(`/products/${12345}/downloadSongSample`)
        .send()
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });

    it('send sqs message to reload song samples', async () => {
      // overwrite config
      const sqsConfig = {
        sqsEnabled: true,
        queueName: 'test-queue',
      };
      appConfigGetStub.withArgs('sqsConfig').returns(sqsConfig);

      // add an album with a few tracks
      const requiredBody = {
        source: {
          sampleUrl: undefined,
        },
        meta: {},
        isActive: true,
      };
      const albumSchema = (await productTypeMan.getProductType('album'))
        .jsonSchema;
      const trackSchema = (await productTypeMan.getProductType('track'))
        .jsonSchema;
      const album = await MusicIntegrationTestSuite.loadAlbumWithTracks(
        albumSchema,
        trackSchema,
        2,
        requiredBody,
        requiredBody,
      );

      await request(app)
        .post(`/products/${album.productId}/downloadSongSample`)
        .send()
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      sinon.verify();
    });
  });
});
