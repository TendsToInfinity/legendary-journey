import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { CatalogService } from '../../../../src/CatalogService';
import {
  ProductTypeIds,
  VendorNames,
} from '../../../../src/controllers/models/Product';
import { ProductManager } from '../../../../src/lib/ProductManager';
import { ProductTypeManager } from '../../../../src/lib/ProductTypeManager';
import { app } from '../../../../src/main';
import { ProductUpdateCidnFulfillmentResponseHandler } from '../../../../src/messaging/handlers/ProductUpdateCidnFulfillmentResponseHandler';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';

describe('ProductUpdateCidnFulfillmentResponseHandler - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let productMan: ProductManager;
  let productUpdateCidnFulfillmentResponseHandler: ProductUpdateCidnFulfillmentResponseHandler;
  let productTypeMan: ProductTypeManager;
  const albumVendorId = '1';

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(async () => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    productMan = new ProductManager();
    productTypeMan = new ProductTypeManager();
    productUpdateCidnFulfillmentResponseHandler =
      new ProductUpdateCidnFulfillmentResponseHandler();

    const albumSchema = await productTypeMan.getProductType(
      ProductTypeIds.Album,
    );
    const albumProduct = ModelFactory.productFromSchema(
      albumSchema.jsonSchema,
      {
        source: {
          vendorName: VendorNames.AudibleMagic,
          vendorProductId: albumVendorId,
        },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: 'someURL',
          releaseYear: 1984,
        },
      },
    );
    await request(app)
      .post(`/products`)
      .set('X-API-KEY', 'API_KEY_DEV')
      .send(albumProduct);

    const trackSchema = await productTypeMan.getProductType(
      ProductTypeIds.Track,
    );
    const trackProduct = ModelFactory.productFromSchema(
      trackSchema.jsonSchema,
      {
        source: {
          vendorProductId: '2',
          vendorName: VendorNames.AudibleMagic,
          vendorParentProductId: albumVendorId,
        },
        meta: { basePrice: { purchase: 1.5 } },
      },
    );

    await request(app)
      .post(`/products`)
      .set('X-API-KEY', 'API_KEY_DEV')
      .send(trackProduct);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should update an existing product', async () => {
      const s3Path = 'am/2/2.mp3';
      const vendorProductId = '2';
      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [{ vendorProductId, fileName: '2.mp3', s3Path }],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';

      await productUpdateCidnFulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );
      const existingProduct = await productMan.findOneByVendorProductId(
        vendorProductId,
        vendorName,
        ProductTypeIds.Track,
      );

      expect(existingProduct.source.vendorProductId).to.equal('2');
      expect(existingProduct.source.s3Path).to.equal(s3Path);
    });

    it('should not update the product as product is missing', async () => {
      const s3Path = 'am/3/3.mp3';
      const vendorProductId = '3';
      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [{ vendorProductId, fileName: '2.mp3', s3Path }],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';

      await productUpdateCidnFulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );
      const existingProduct = await productMan.findOneByVendorProductId(
        vendorProductId,
        vendorName,
        ProductTypeIds.Track,
      );

      expect(existingProduct).to.be.undefined;
    });

    it('should not update the product as s3path is same, so version of the product should remain same as earlier', async () => {
      const s3Path = 'am/4/4.mp3';
      const vendorProductId = '4';
      const trackSchema = await productTypeMan.getProductType(
        ProductTypeIds.Track,
      );
      const trackProduct = ModelFactory.productFromSchema(
        trackSchema.jsonSchema,
        {
          source: {
            vendorProductId,
            vendorName: VendorNames.AudibleMagic,
            vendorParentProductId: albumVendorId,
            s3Path,
          },
          meta: { basePrice: { purchase: 1.5 } },
        },
      );

      await request(app)
        .post(`/products`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .send(trackProduct);

      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [{ vendorProductId, fileName: '4.mp3', s3Path }],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';
      const beforeUpdate = await productMan.findOneByVendorProductId(
        vendorProductId,
        vendorName,
        ProductTypeIds.Track,
      );

      await productUpdateCidnFulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );
      const afterProduct = await productMan.findOneByVendorProductId(
        vendorProductId,
        vendorName,
        ProductTypeIds.Track,
      );

      expect(afterProduct.source.vendorProductId).to.equal('4');
      expect(afterProduct.source.s3Path).to.equal(s3Path);
      expect(afterProduct).to.deep.equal(beforeUpdate);
    });
  });
});
