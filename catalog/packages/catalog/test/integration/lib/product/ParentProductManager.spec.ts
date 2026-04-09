import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as sinon from 'sinon';
import { CatalogService } from '../../../../src/CatalogService';
import { ProductTypeIds } from '../../../../src/controllers/models/Product';
import { ProductDao } from '../../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { OpenSearchManager } from '../../../../src/lib/OpenSearchManager';
import { ProductType } from '../../../../src/lib/models/ProductType';
import { ParentProductManager } from '../../../../src/lib/product/ParentProductManager';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';
import * as client from '../../../utils/client';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';
import '../../global.spec';

describe('ParentProductManager - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let parentProductManager: ParentProductManager;
  let productTypeDao: ProductTypeDao;
  let trackSchema: Schema;
  let trackProductType: ProductType;
  let albumSchema: Schema;
  let productDao: ProductDao;
  let openSearchManager: OpenSearchManager;

  const context = { apiKey: 'test' };

  before(async () => {
    await CatalogService.bindAll();
    productTypeDao = new ProductTypeDao();
    trackProductType = await productTypeDao.findOneOrFail(ProductTypeIds.Track);
    trackSchema = trackProductType.jsonSchema;
    albumSchema = (await productTypeDao.findOneOrFail(ProductTypeIds.Album))
      .jsonSchema;
    productDao = new ProductDao();
    openSearchManager = new OpenSearchManager();
  });

  beforeEach(async () => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    parentProductManager = new ParentProductManager();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getParentProduct', () => {
    it('should retrieve the parentProduct', async () => {
      const parentProduct = ModelFactory.productFromSchema(
        albumSchema,
        {
          source: {
            vendorName: 'NEU',
            vendorProductId: '123',
            productTypeId: ProductTypeIds.Album,
          },
        },
        ['productId'],
      );
      const childProduct = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorName: 'NEU',
            vendorProductId: '1234',
            productTypeId: ProductTypeIds.Track,
            vendorParentProductId: parentProduct.source.vendorProductId,
          },
        },
        ['productId'],
      );
      const { productId: parentId } = await client.createProduct(parentProduct);

      const result = await parentProductManager.getParentProduct(
        childProduct,
        trackProductType,
      );
      expect(result.productId).to.equal(parentId);
    });
    it('should throw an error if the productSchema does not have a parentProductTypeId', async () => {
      const deviceProductType = await productTypeDao.findOneOrFail('device');
      const product = ModelFactory.productFromSchema(
        deviceProductType.jsonSchema,
      );
      try {
        await parentProductManager.getParentProduct(product, deviceProductType);
        expect.fail();
      } catch (error) {
        expect(error.code).to.equal(422);
      }
    });
  });

  describe('setParentSubscriptionAvailability', () => {
    it('should set afs=true if parent=false and child=true', async () => {
      const child = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorParentProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: true,
            productTypeId: ProductTypeIds.Track,
          },
        },
        ['productId'],
      );
      const parent = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: false,
            productTypeId: ProductTypeIds.Album,
          },
        },
        ['productId'],
      );
      const parentId = await productDao.create(parent, context);
      const childId = await productDao.create(child, context);
      await parentProductManager.addChildToParent(childId, parentId, context);

      const parentProduct = await productDao.findOne(parentId);
      const childProduct = await productDao.findOne(childId);

      await parentProductManager.setParentSubscriptionAvailability(
        childProduct,
        parentProduct,
        context,
      );

      const updatedParent = await productDao.findOne(parentId);
      expect(updatedParent.source.availableForSubscription).to.equal(true);
    });
    it('should set afs=true if parent=false and child=false and sibling=true', async () => {
      const child = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorParentProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: false,
            productTypeId: ProductTypeIds.Track,
          },
        },
        ['productId'],
      );
      const sibling = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorParentProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: true,
            productTypeId: ProductTypeIds.Track,
          },
        },
        ['productId'],
      );
      const parent = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: false,
            productTypeId: ProductTypeIds.Album,
          },
        },
        ['productId'],
      );
      const parentId = await productDao.create(parent, context);
      const childId = await productDao.create(child, context);
      const siblingId = await productDao.create(sibling, context);
      await parentProductManager.addChildToParent(childId, parentId, context);
      await parentProductManager.addChildToParent(siblingId, parentId, context);

      const parentProduct = await productDao.findOne(parentId);
      const childProduct = await productDao.findOne(childId);

      await parentProductManager.setParentSubscriptionAvailability(
        childProduct,
        parentProduct,
        context,
      );

      const updatedParent = await productDao.findOne(parentId);
      expect(updatedParent.source.availableForSubscription).to.equal(true);
    });
    it('should set afs=false if parent=true and child=false and sibling=false', async () => {
      const child = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorParentProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: false,
            productTypeId: ProductTypeIds.Track,
          },
        },
        ['productId'],
      );
      const sibling = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorParentProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: false,
            productTypeId: ProductTypeIds.Track,
          },
        },
        ['productId'],
      );
      const parent = ModelFactory.productFromSchema(
        trackSchema,
        {
          source: {
            vendorProductId: '123',
            vendorName: 'NEU',
            availableForSubscription: true,
            productTypeId: ProductTypeIds.Album,
          },
        },
        ['productId'],
      );
      const parentId = await productDao.create(parent, context);
      const childId = await productDao.create(child, context);
      const siblingId = await productDao.create(sibling, context);
      await parentProductManager.addChildToParent(childId, parentId, context);
      await parentProductManager.addChildToParent(siblingId, parentId, context);

      const parentProduct = await productDao.findOne(parentId);
      const childProduct = await productDao.findOne(childId);

      await parentProductManager.setParentSubscriptionAvailability(
        childProduct,
        parentProduct,
        context,
      );

      const updatedParent = await productDao.findOne(parentId);
      expect(updatedParent.source.availableForSubscription).to.equal(false);
    });
  });

  describe('addChildToParent', () => {
    it('should add childProductIds to the parent', async () => {
      const parentProduct = ModelFactory.productFromSchema(
        albumSchema,
        {
          source: {
            vendorName: 'NEU',
            vendorProductId: '123',
            productTypeId: ProductTypeIds.Album,
          },
        },
        ['productId'],
      );
      const { productId } = await client.createProduct(parentProduct);
      await Promise.all([
        parentProductManager.addChildToParent(999, productId, context),
        parentProductManager.addChildToParent(9999, productId, context),
        parentProductManager.addChildToParent(99999, productId, context),
        parentProductManager.addChildToParent(999999, productId, context),
      ]);
      const product = await client.getProduct(productId);
      expect(product.childProductIds).to.have.members([
        999, 9999, 99999, 999999,
      ]);
    });
  });
});
