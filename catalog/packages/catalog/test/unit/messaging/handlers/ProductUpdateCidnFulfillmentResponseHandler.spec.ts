import * as sinon from 'sinon';
import {
  ProductTypeIds,
  VendorNames,
} from '../../../../src/controllers/models/Product';
import { ProductUpdateCidnFulfillmentResponseHandler } from '../../../../src/messaging/handlers/ProductUpdateCidnFulfillmentResponseHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('ProductUpdateCidnFulfillmentResponseHandler', () => {
  let productUpdateCIDNfulfillmentResponseHandler: ProductUpdateCidnFulfillmentResponseHandler;
  let mockProductManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    productUpdateCIDNfulfillmentResponseHandler =
      new ProductUpdateCidnFulfillmentResponseHandler();
    mockProductManager = sinon.mock(
      (productUpdateCIDNfulfillmentResponseHandler as any).productManager,
    );
    mockLogger = sinon.mock(
      (productUpdateCIDNfulfillmentResponseHandler as any).log,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call updateProduct', async () => {
      const s3Path = 'am/534057439/534057439.mp3';
      const vendorProductId = '534057439';
      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [
          {
            vendorProductId,
            fileName: '534057439.mp3',
            s3Path,
          },
        ],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: { vendorName, vendorProductId },
      });
      const productTypeId = product.source.productTypeId;
      const updatedProduct = {
        ...product,
        source: { vendorName, vendorProductId, s3Path, productTypeId },
      };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          ProductTypeIds.Track,
        )
        .resolves(product);
      mockProductManager
        .expects('updateProduct')
        .withExactArgs(updatedProduct, { routingKey })
        .resolves();

      await productUpdateCIDNfulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );

      mockProductManager.verify();
    });

    it('should skip non existing product', async () => {
      const s3Path = 'am/534057439/534057439.mp3';
      const vendorProductId = '534057439';
      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [
          {
            vendorProductId,
            fileName: '534057439.mp3',
            s3Path,
          },
        ],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: { vendorName, vendorProductId },
      });
      const updatedProduct = {
        ...product,
        source: { vendorName, vendorProductId, s3Path },
      };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          ProductTypeIds.Track,
        )
        .callsFake(() => {
          // Prioritize promises completing before this fake method in event loop.
          // https://dmitripavlutin.com/javascript-promises-settimeout/
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              return resolve(undefined);
            }, 0);
          });
        });
      mockProductManager
        .expects('updateProduct')
        .withExactArgs(updatedProduct, { routingKey })
        .never();
      mockLogger
        .expects('error')
        .withArgs(
          `Cannot find product ${vendorProductId} for vendor: ${vendorName}`,
        );

      await productUpdateCIDNfulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );

      mockProductManager.verify();
      mockLogger.verify();
    });

    it('should skip product if it has delivery error', async () => {
      const s3Path = 'am/534057439/534057439.mp3';
      const vendorProductId = '534057439';
      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [
          {
            vendorProductId,
            fileName: '534057439.mp3',
            s3Path,
            error: 'something vent wrong',
          },
        ],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: { vendorName, vendorProductId },
      });
      const updatedProduct = {
        ...product,
        source: { vendorName, vendorProductId, s3Path },
      };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          ProductTypeIds.Track,
        )
        .never();
      mockProductManager
        .expects('updateProduct')
        .withExactArgs(updatedProduct, { routingKey })
        .never();
      mockLogger
        .expects('error')
        .withArgs(
          `Cannot find product ${vendorProductId} for vendor: ${vendorName}`,
        )
        .never();

      await productUpdateCIDNfulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );

      mockProductManager.verify();
      mockLogger.verify();
    });

    it('should not invoke the findOneByVendorProductId and updateProduct', async () => {
      const s3Path = 'am/534057439/534057439.mp3';
      const vendorProductId = '534057439';
      const message = ModelFactory.cidnMusicSharedOutput({
        vendor: VendorNames.Swank,
        contentToDeliver: [
          {
            vendorProductId,
            fileName: '534057439.mp3',
            s3Path,
          },
        ],
      });
      const routingKey = 'test';
      mockProductManager.expects('findOneByVendorProductId').never();
      mockProductManager.expects('updateProduct').never();
      await productUpdateCIDNfulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );
      sinon.verify();
    });

    it('should not call updateProduct as s3Path matches with current', async () => {
      const s3Path = 'am/534057439/534057439.mp3';
      const vendorProductId = '534057439';
      const message = ModelFactory.cidnMusicSharedOutput({
        contentToDeliver: [
          {
            vendorProductId,
            fileName: '534057439.mp3',
            s3Path,
          },
        ],
      });
      const vendorName = message.vendor;
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: { vendorName, vendorProductId, s3Path },
      });
      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          ProductTypeIds.Track,
        )
        .resolves(product);
      mockProductManager.expects('updateProduct').never();
      await productUpdateCIDNfulfillmentResponseHandler.handleMessage(
        routingKey,
        message,
      );
      mockProductManager.verify();
    });
  });
});
