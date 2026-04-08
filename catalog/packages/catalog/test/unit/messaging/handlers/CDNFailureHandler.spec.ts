import * as sinon from 'sinon';
import { VendorNames } from '../../../../src/controllers/models/Product';
import { MessagingConstants } from '../../../../src/messaging/MessagingConstants';
import { CDNFailureHandler } from '../../../../src/messaging/handlers/CDNFailureHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('CDNFailureHandler - Unit', () => {
  let cdnFailureHandler: CDNFailureHandler;
  let mockProductManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    cdnFailureHandler = new CDNFailureHandler();
    mockProductManager = sinon.mock((cdnFailureHandler as any).productManager);
    mockLogger = sinon.mock((cdnFailureHandler as any).log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call updateProduct with availableForPurchase false for unpurchasable', async () => {
      const routingKey = MessagingConstants.CIDN_ORDER_PRODUCT_UNPURCHASABLE;
      const product = ModelFactory.product({
        source: {
          availableForPurchase: true,
          availableForSubscription: true,
          vendorName: VendorNames.AudibleMagic,
        },
      });
      const updatedProduct = {
        ...product,
        source: { ...product.source, availableForPurchase: false },
      };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          product.source.productTypeId,
        )
        .resolves(product);

      mockProductManager
        .expects('updateProduct')
        .withExactArgs(updatedProduct, { routingKey })
        .resolves();

      await cdnFailureHandler.handleMessage(routingKey, {
        vendorName: product.source.vendorName as VendorNames,
        vendorProductId: product.source.vendorProductId,
        productTypeId: product.source.productTypeId,
        error: 'who cares',
      });

      mockProductManager.verify();
    });
    it('should call updateProduct with availableForSubscription false for unsubscribable', async () => {
      const routingKey = MessagingConstants.CIDN_ORDER_PRODUCT_UNSUBSCRIBABLE;
      const product = ModelFactory.product({
        source: {
          availableForPurchase: true,
          availableForSubscription: true,
          vendorName: VendorNames.AudibleMagic,
        },
      });
      const updatedProduct = {
        ...product,
        source: { ...product.source, availableForSubscription: false },
      };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          product.source.productTypeId,
        )
        .resolves(product);

      mockProductManager
        .expects('updateProduct')
        .withExactArgs(updatedProduct, { routingKey })
        .resolves();

      await cdnFailureHandler.handleMessage(routingKey, {
        vendorName: product.source.vendorName as VendorNames,
        vendorProductId: product.source.vendorProductId,
        productTypeId: product.source.productTypeId,
        error: 'who cares',
      });

      mockProductManager.verify();
    });
    it('should log out if product not found somehow?', async () => {
      const routingKey = MessagingConstants.CIDN_ORDER_PRODUCT_UNSUBSCRIBABLE;
      const product = ModelFactory.product({
        source: {
          availableForPurchase: true,
          availableForSubscription: true,
          vendorName: VendorNames.AudibleMagic,
        },
      });
      const message = {
        vendorName: product.source.vendorName as VendorNames,
        vendorProductId: product.source.vendorProductId,
        productTypeId: product.source.productTypeId,
        error: 'who cares',
      };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          product.source.productTypeId,
        )
        .resolves(undefined);

      mockProductManager.expects('updateProduct').never();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Product not found for vendorProductId: ${message.vendorProductId}, vendorName: ${message.vendorName}, productTypeId: ${message.productTypeId}`,
        );

      await cdnFailureHandler.handleMessage(routingKey, message);
      sinon.verify();
    });
  });
});
