import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import {
  ProductSales,
  ProductSalesSearch,
} from '../../../../src/controllers/models/Product';
import { ProductSalesManager } from '../../../../src/lib/ProductSalesManager';
import { OrderCompleteHandler } from '../../../../src/messaging/handlers/OrderCompleteHandler';
import { OrderState } from '../../../../src/models/Order';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('OrderCompleteHandler - Unit', () => {
  let orderCompleteHandler: OrderCompleteHandler;
  let productSalesManager: ProductSalesManager;
  let mockProductSalesManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    orderCompleteHandler = new OrderCompleteHandler();
    productSalesManager = new ProductSalesManager();
    mockProductSalesManager = sinon.mock(
      (orderCompleteHandler as any).productSalesManager,
    );
    mockLogger = sinon.mock((orderCompleteHandler as any).log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should return true if order state is not complete', async () => {
      const routingKey = 'ROUTING_KEY';
      const order = ModelFactory.order({
        state: OrderState.Finished,
        product: {
          productTypeGroupId: 'music',
        },
      });
      mockProductSalesManager.expects('findOne').never();
      mockProductSalesManager.expects('createProductSales').never();
      mockProductSalesManager.expects('incrementCompletedOrders').never();

      const result = await orderCompleteHandler.handleMessage(
        routingKey,
        order,
      );

      expect(result).to.be.true;

      sinon.verify();
    });

    it('should return true if product type group is tablet package', async () => {
      const routingKey = 'ROUTING_KEY';
      const order = ModelFactory.order({
        state: OrderState.Complete,
        product: {
          productTypeGroupId: 'tabletPackage',
        },
      });
      mockProductSalesManager.expects('findOne').never();
      mockProductSalesManager.expects('createProductSales').never();
      mockProductSalesManager.expects('incrementCompletedOrders').never();

      const result = await orderCompleteHandler.handleMessage(
        routingKey,
        order,
      );

      expect(result).to.be.true;

      sinon.verify();
    });

    it('should call findOne with order parameters', async () => {
      const routingKey = 'ROUTING_KEY';
      const order = ModelFactory.order({
        state: OrderState.Complete,
        product: {
          productTypeGroupId: 'music',
        },
      });
      const productSalesSearchCriteria: ProductSalesSearch =
        productSalesManager.toProductSalesSearch(order);

      mockProductSalesManager
        .expects('findOne')
        .withExactArgs({ by: productSalesSearchCriteria })
        .resolves(ModelFactory.productSales());
      mockProductSalesManager.expects('incrementCompletedOrders').resolves();

      const result = await orderCompleteHandler.handleMessage(
        routingKey,
        order,
      );
      expect(result).to.be.true;

      sinon.verify();
    });

    it('should call createOrUpdateProductSales with existing product sales record', async () => {
      const routingKey = 'ROUTING_KEY';
      const order = ModelFactory.order({
        state: OrderState.Complete,
        product: {
          productTypeGroupId: 'music',
        },
      });

      const productSalesSearchCriteria: ProductSalesSearch =
        productSalesManager.toProductSalesSearch(order);
      const productSalesRecord = {
        ...productSalesSearchCriteria,
      } as ProductSales;
      productSalesRecord.productSalesId = faker.random.number(100000);

      mockProductSalesManager
        .expects('findOne')
        .withExactArgs({ by: productSalesSearchCriteria })
        .resolves(productSalesRecord);
      mockProductSalesManager.expects('incrementCompletedOrders').resolves();

      const result = await orderCompleteHandler.handleMessage(
        routingKey,
        order,
      );
      expect(result).to.be.true;

      sinon.verify();
    });

    it('should call createProductSales with new product sales record', async () => {
      const routingKey = 'ROUTING_KEY';
      const order = ModelFactory.order({
        state: OrderState.Complete,
        product: {
          productTypeGroupId: 'music',
        },
      });

      const productSalesSearchCriteria: ProductSalesSearch =
        productSalesManager.toProductSalesSearch(order);

      mockProductSalesManager
        .expects('findOne')
        .withExactArgs({ by: productSalesSearchCriteria })
        .resolves(undefined);

      const newProductSales = {
        ...productSalesSearchCriteria,
        completedOrders: 1,
        productName: order.product.name,
      };
      mockProductSalesManager
        .expects('createProductSales')
        .withExactArgs(newProductSales, { routingKey })
        .resolves();

      const result = await orderCompleteHandler.handleMessage(
        routingKey,
        order,
      );
      expect(result).to.be.true;

      sinon.verify();
    });

    it('given error, should log error', async () => {
      const routingKey = 'ROUTING_KEY';
      const order = ModelFactory.order({
        state: OrderState.Complete,
        product: {
          productTypeGroupId: 'music',
        },
      });

      const productSalesSearchCriteria: ProductSalesSearch =
        productSalesManager.toProductSalesSearch(order);
      const productSalesRecord = {
        ...productSalesSearchCriteria,
      } as ProductSales;
      productSalesRecord.productSalesId = undefined;

      mockProductSalesManager
        .expects('findOne')
        .withExactArgs({ by: productSalesSearchCriteria })
        .throws();
      mockLogger.expects('error').twice();

      const result = await orderCompleteHandler.handleMessage(
        routingKey,
        order,
      );
      expect(result).to.be.true;

      sinon.verify();
    });
  });
});
