import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CatalogService } from '../../../../src/CatalogService';
import { ProductStatus } from '../../../../src/controllers/models/Product';
import { ProductDao } from '../../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { ProductManager } from '../../../../src/lib/ProductManager';
import { LegacyInactiveProductHandler } from '../../../../src/messaging/handlers/LegacyInactiveProductHandler';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('LegacyInactiveProductHandler - Integration', () => {
  let productDao: ProductDao;
  let productMan: ProductManager;
  let productTypeDao: ProductTypeDao;
  let legacyInactiveProductHandler: LegacyInactiveProductHandler;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    productDao = new ProductDao();
    productMan = new ProductManager();
    productTypeDao = new ProductTypeDao();
    legacyInactiveProductHandler = new LegacyInactiveProductHandler();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should create new product', async () => {
      const routingKey = 'test';
      const albumType = await productTypeDao.findOneOrFail('album');
      const fakedAlbum = ModelFactory.productFromSchema(albumType.jsonSchema, {
        meta: { name: 'Test Album' },
      });

      await legacyInactiveProductHandler.handleMessage(routingKey, {
        product: fakedAlbum,
      });

      const result = await productMan.search({
        query: {
          clauses: {
            'meta.name': ['Test Album'],
          },
          productTypeId: 'album',
        },
      });

      const album = result.data.find(
        (prod) => (prod.meta.name = fakedAlbum.meta.name),
      );

      expect(album).to.be.not.null;
      expect(album.productId).to.be.not.null;
      expect(album.productTypeId).to.equal(fakedAlbum.productTypeId);
      expect(album.status).to.equal(ProductStatus.Inactive);
      expect(album.source.availableForPurchase).to.equal(false);
      expect(album.source.availableForSubscription).to.equal(false);
    });

    it('should skip creation for existing product', async () => {
      const routingKey = 'test';
      const albumType = await productTypeDao.findOneOrFail('album');
      const existingAlbum = ModelFactory.productFromSchema(
        albumType.jsonSchema,
        {
          source: {
            vendorProductId: '1234',
            vendorName: 'Neurotic',
          },
        },
      );

      const productId = await productDao.create(existingAlbum, {
        apiKey: 'test',
      });

      const updatedAlbum = _.clone(existingAlbum);
      updatedAlbum.meta.name = 'Updated Name';

      await legacyInactiveProductHandler.handleMessage(routingKey, {
        product: updatedAlbum,
      });

      const updateProduct = await productDao.findOneOrFail(productId);

      expect(updateProduct).to.be.not.null;
      expect(updateProduct.meta.name).to.not.equal('Updated Name');
    });
  });
});
