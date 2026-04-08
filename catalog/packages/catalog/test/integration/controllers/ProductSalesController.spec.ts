import { CorpJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { Product, ProductStatus } from '../../../db/reference/Product';
import {
  ProductSales,
  ProductTypeIds,
} from '../../../src/controllers/models/Product';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductSalesController - Integration', () => {
  let testToken: string;
  const productTypeDao: ProductTypeDao = Container.get(ProductTypeDao);
  let movieSchema: Schema;
  let trackSchema: Schema;

  before(async () => {
    const expectedJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
      permissions: ['catalogAdmin'],
    } as CorpJwt;

    testToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(expectedJwt));

    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
    trackSchema = (await productTypeDao.findOneOrFail('track')).jsonSchema;
  });

  async function createProducts(prods: Product[]): Promise<number[]> {
    return Bluebird.map(prods, async (product) => {
      const {
        body: { productId },
      } = await request(app)
        .post(`/products`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(product)
        .expect(200);
      return productId;
    });
  }

  async function createProductSales(
    prodSales: ProductSales[],
  ): Promise<number[]> {
    return Bluebird.map(prodSales, async (productSale) => {
      const {
        body: { productSalesId },
      } = await request(app)
        .post(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(productSale)
        .expect(200);
      return productSalesId;
    });
  }

  describe('findproductSales', async () => {
    let products: Product[];
    let productIds: number[];
    let productSales: ProductSales[];
    let productSalesIds: number[];

    beforeEach(async () => {
      products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'Aquaman' },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'Batman Begins' },
        }),
      ];

      productIds = await createProducts(products);

      productSales = [
        ModelFactory.productSales({
          productId: productIds[0],
          customerId: 'I-003320',
        }),
        ModelFactory.productSales({
          productId: productIds[1],
          customerId: 'I-003321',
        }),
      ];

      productSalesIds = await createProductSales(productSales);
    });

    it('finds productSales with no permissions', async () => {
      const expectedJwt = {
        jwtType: JwtType.Corporate,
        username: 'testy',
      } as CorpJwt;
      const corpJwt = await SecurityFactory.jwt(
        SecurityFactory.corpJwt(expectedJwt),
      );

      const { body: foundproductSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200);

      expect(foundproductSales.data).to.have.lengthOf(2);
    });
    it('can find all productSales', async () => {
      const { body: foundproductSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(foundproductSales.data).to.have.lengthOf(2);
    });
    it('can find all productSales with total', async () => {
      const { body: foundproductSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ total: true })
        .expect(200);

      expect(foundproductSales.total).to.equal(2);
      expect(foundproductSales.data).to.have.lengthOf(2);
    });
    it('can find productSales by matching fields', async () => {
      const { body: foundproductSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ customerId: 'I-003320' })
        .expect(200);

      expect(foundproductSales.data).to.have.lengthOf(1);
    });
  });

  describe('updateProductSales', () => {
    let products: Product[];
    let productIds: number[];
    let productSales: ProductSales[];
    let productSalesIds: number[];

    beforeEach(async () => {
      products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'Aquaman' },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'Batman Begins' },
        }),
      ];

      productIds = await createProducts(products);

      productSales = [
        ModelFactory.productSales({
          productId: productIds[0],
          customerId: 'I-003320',
        }),
        ModelFactory.productSales({
          productId: productIds[1],
          customerId: 'I-003321',
        }),
      ];

      productSalesIds = await createProductSales(productSales);
    });

    it('updates a productSales', async () => {
      const { body: foundprodSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ productSalesId: productSalesIds[0] })
        .expect(200);
      const changedproductSales = {
        ...foundprodSales.data[0],
        productSalesId: productSalesIds[0],
        artistProductId: productSales[0].artistProductId,
        parentProductId: productSales[0].parentProductId,
        customerId: 'I-111111',
      };
      await request(app)
        .put(`/productSales/${productSalesIds[0]}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(changedproductSales)
        .expect(204);

      const { body: foundproductSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ productSalesId: productSalesIds[0] })
        .expect(200);

      expect(foundproductSales.data[0].customerId).to.equal('I-111111');
    });

    it('gets a 404', async () => {
      const prodSales = ModelFactory.productSales();
      await request(app)
        .put(`/productSales/${prodSales.productSalesId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(prodSales)
        .expect(404);
    });
  });

  describe('create productSales', async () => {
    let i = 0;
    let products: Product[];
    let productIds: number[];
    let productSales: ProductSales[];
    let productSalesIds: number[];
    const vendorArtistId = 'vendorArtistId';
    const vendorName = 'vendorName';
    const productTypeGroupId = 'music';

    beforeEach(async () => {
      products = [
        ModelFactory.product({
          source: {
            vendorProductId: vendorArtistId,
            vendorArtistId: vendorArtistId,
            vendorName,
          },
          parentProductId: 16,
          productTypeId: ProductTypeIds.Artist,
          meta: { name: 'Led Zeppelin' },
          productTypeGroupId,
        }),
        ModelFactory.productFromSchema(trackSchema, {
          source: {
            vendorProductId: vendorArtistId,
            vendorArtistId: vendorArtistId,
            vendorName,
          },
          status: ProductStatus.PendingReview,
          meta: { name: 'Stairway to Heaven' },
          ProductTypeId: ProductTypeIds.Track,
          parentProductId: 15,
        }),
      ];

      productIds = await createProducts(products);

      productSales = [
        ModelFactory.productSales({
          productId: productIds[1],
          customerId: 'I-003320',
          productTypeId: ProductTypeIds.Track,
          artistProductId: 0,
          completedOrders: i < 2 ? 0 : undefined,
          parentProductId: 15,
        }),
      ];

      i++;
      productSalesIds = await createProductSales(productSales);
    });

    it('creates a productSales and sets artistProductId from artist', async () => {
      productSales[0].artistProductId = productIds[0];

      const { body: foundProductSales } = await request(app)
        .get(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ productSalesId: productSalesIds[0] })
        .expect(200);

      expect(
        _.omit(
          foundProductSales.data[0],
          'productSalesId',
          'cdate',
          'udate',
          'version',
        ),
      ).to.deep.equal(
        _.omit(productSales[0], 'productSalesId', 'cdate', 'udate', 'version'),
      );
      expect(_.keys(foundProductSales.data[0])).to.have.members([
        'productSalesId',
        'productTypeGroupId',
        'productTypeId',
        'purchaseType',
        'customerId',
        'productId',
        'parentProductId',
        'artistProductId',
        'productName',
        'completedOrders',
        'year',
        'month',
        'day',
        'version',
        'cdate',
        'udate',
      ]);
    });

    it('creates a productSales and increments product and artist total sales count by 1 in OpenSearch', async () => {
      const artist = ModelFactory.product({
        productTypeId: ProductTypeIds.Artist,
        meta: { name: 'Led Zeppelin' },
        productTypeGroupId,
      });
      const {
        body: { artistId },
      } = await request(app)
        .post(`/products`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(artist)
        .expect(200);
      artist.productId = artistId;

      const product = ModelFactory.productFromSchema(trackSchema, {
        source: {
          vendorArtistId: artist.source.vendorProductId,
          vendorName: artist.source.vendorName,
        },
        status: ProductStatus.PendingReview,
        meta: { name: 'Stairway to Heaven' },
        productTypeId: ProductTypeIds.Track,
      });
      const {
        body: { productId },
      } = await request(app)
        .post(`/products`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(product)
        .expect(200);
      product.productId = productId;

      const productSale = ModelFactory.productSales({
        productId: product.productId,
        customerId: 'I-003320',
        productTypeId: ProductTypeIds.Track,
        artistProductId: artist.productId,
      });
      delete productSale.completedOrders;
      const {
        body: { productSalesId },
      } = await request(app)
        .post(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(productSale)
        .expect(200);
      productSale.productSalesId = productSalesId;

      await Bluebird.delay(1000);

      await request(app)
        .get(`/test/cache/clear`)
        .set('X-API-KEY', `API_KEY_DEV`)
        .expect(204);

      const { body: searchResult } = await request(app)
        .post('/products/search')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          query: {
            productTypeId: product.productTypeId,
            clauses: {},
            productId: product.productId,
          },
          orderBy: [{ cdate: 'DESC' }],
          total: false,
        });

      const { body: artistSearchResult } = await request(app)
        .post('/products/search')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          query: {
            productTypeId: artist.productTypeId,
            clauses: {},
            productId: artist.productId,
          },
          orderBy: [{ cdate: 'DESC' }],
          total: false,
        });

      expect(searchResult.data[0].digest.sales.totalSales).to.equal(1);
      expect(artistSearchResult.data[0].digest.sales.totalSales).to.equal(1);
    });

    it('creates a productSales and sets product and artist total sales count to the value of completedOrders in OpenSearch', async () => {
      await Bluebird.delay(1000);

      const { body: searchResult } = await request(app)
        .post('/products/search')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          query: {
            productTypeId: productSales[0].productTypeId,
            clauses: {},
            productId: productIds[1].toString(),
          },
          orderBy: [{ cdate: 'DESC' }],
          total: false,
        });

      const { body: artistSearchResult } = await request(app)
        .post('/products/search')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          query: {
            productTypeId: products[0].productTypeId,
            clauses: {},
            productId: productIds[0].toString(),
          },
          orderBy: [{ cdate: 'DESC' }],
          total: false,
        });

      expect(searchResult.data[0].digest.sales.totalSales).to.equal(
        productSales[0].completedOrders,
      );
      expect(artistSearchResult.data[0].digest.sales.totalSales).equal(
        productSales[0].completedOrders,
      );
    });

    it('should throw a 409 if productSales already exists', async () => {
      await request(app)
        .post(`/productSales`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(productSales[0])
        .expect(409);
    });
  });
});
