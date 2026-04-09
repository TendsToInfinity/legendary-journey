import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ProductTypeIds } from '../../../../src/controllers/models/Product';
import { ParentProductManager } from '../../../../src/lib/product/ParentProductManager';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('ParentProductManager - Unit', () => {
  let parentProductManager: ParentProductManager;
  let productTypeManagerMock: sinon.SinonMock;
  let parentProductDaoMock: sinon.SinonMock;
  let productDaoMock: sinon.SinonMock;
  let productPublishManagerMock: sinon.SinonMock;

  const context = { apiKey: 'apiKey' };

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    parentProductManager = new ParentProductManager();
    productTypeManagerMock = sinon.mock(
      (parentProductManager as any).productTypeManager,
    );
    parentProductDaoMock = sinon.mock(
      (parentProductManager as any).parentProductDao,
    );
    productDaoMock = sinon.mock((parentProductManager as any).productDao);
    productPublishManagerMock = sinon.mock(
      (parentProductManager as any).productPublishManager,
    );
  });

  afterEach(() => {
    sinon.restore();
  });
  describe('getParentProduct', () => {
    it('should return a parent product', async () => {
      const productType = ModelFactory.productType();
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });
      productTypeManagerMock
        .expects('getValueFromJsonSchemaByFieldName')
        .withExactArgs(productType, 'parentProductTypeId')
        .resolves([productType.productTypeId]);
      productDaoMock
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorParentProductId,
          product.source.vendorName,
          productType.productTypeId,
        );
      await parentProductManager.getParentProduct(product, productType);
      productTypeManagerMock.verify();
      productDaoMock.verify();
    });
    it('should throw 422 for product without parent defined in schema', async () => {
      const productType = ModelFactory.productType();
      const product = ModelFactory.product({
        source: { vendorProductId: '123', vendorName: 'Foobar' },
      });
      productTypeManagerMock
        .expects('getValueFromJsonSchemaByFieldName')
        .withExactArgs(productType, 'parentProductTypeId')
        .resolves([]);
      productDaoMock.expects('findOneByVendorProductId').never();
      try {
        await parentProductManager.getParentProduct(product, productType);
        expect.fail();
      } catch (err) {
        expect(err.code).to.equal(422);
        expect(err.errors[0]).to.contain(`vendorProductId: 123`);
        expect(err.errors[0]).to.contain(`vendor name: Foobar`);
        expect(err.errors[0]).to.contain(
          `${productType.productTypeId} does not yet exist.`,
        );
      }
      productTypeManagerMock.verify();
      productDaoMock.verify();
    });
    it('should lookup the productType if one is not passed in', async () => {
      const productType = ModelFactory.productType();
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });
      productTypeManagerMock
        .expects('getProductType')
        .withExactArgs(product.productTypeId)
        .resolves(productType);
      productTypeManagerMock
        .expects('getValueFromJsonSchemaByFieldName')
        .withExactArgs(productType, 'parentProductTypeId')
        .resolves([productType.productTypeId]);
      productDaoMock
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorParentProductId,
          product.source.vendorName,
          productType.productTypeId,
        );
      await parentProductManager.getParentProduct(product);
      productTypeManagerMock.verify();
      productDaoMock.verify();
    });
  });
  describe('setParentSubscriptionAvailability', () => {
    it('should set available to true if the product is available and the parent is not', async () => {
      const product = ModelFactory.product({
        source: { availableForSubscription: true },
        productTypeId: ProductTypeIds.Track,
      });
      const parentProduct = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Album,
      });
      parentProductDaoMock.expects('find').never();
      parentProductDaoMock
        .expects('updateAvailableForSubscription')
        .withExactArgs(parentProduct.productId, true, context)
        .resolves(parentProduct);
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
      productPublishManagerMock.verify();
    });
    it('should set parent to available if child is not available but sibling is', async () => {
      const product = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Track,
      });
      const siblingProduct = ModelFactory.product({
        source: { availableForSubscription: true },
        productTypeId: ProductTypeIds.Track,
      });
      const parentProduct = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Album,
        childProductIds: [product.productId, siblingProduct.productId],
      });
      parentProductDaoMock
        .expects('find')
        .withExactArgs({ ids: parentProduct.childProductIds })
        .resolves([product, siblingProduct]);
      parentProductDaoMock
        .expects('updateAvailableForSubscription')
        .withExactArgs(parentProduct.productId, true, context)
        .resolves(parentProduct);
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
      productPublishManagerMock.verify();
    });
    it('should do nothing if product is not a track', async () => {
      const product = ModelFactory.product({ productTypeId: 'lamborghini' });
      const parentProduct = ModelFactory.product();
      parentProductDaoMock.expects('find').never();
      parentProductDaoMock.expects('updateAvailableForSubscription').never();
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
    });
    it('should do nothing if child and parent are available', async () => {
      const product = ModelFactory.product({
        source: { availableForSubscription: true },
        productTypeId: ProductTypeIds.Track,
      });
      const parentProduct = ModelFactory.product({
        source: { availableForSubscription: true },
      });
      parentProductDaoMock.expects('find').never();
      parentProductDaoMock.expects('updateAvailableForSubscription').never();
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
    });
    it('should set parent to not available if no child is available', async () => {
      const product = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Track,
      });
      const siblingProduct = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Track,
      });
      const parentProduct = ModelFactory.product({
        source: { availableForSubscription: true },
        productTypeId: ProductTypeIds.Album,
        childProductIds: [product.productId, siblingProduct.productId],
      });
      parentProductDaoMock
        .expects('find')
        .withExactArgs({ ids: parentProduct.childProductIds })
        .resolves([product, siblingProduct]);
      parentProductDaoMock
        .expects('updateAvailableForSubscription')
        .withExactArgs(parentProduct.productId, false, context)
        .resolves(parentProduct);
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
      productPublishManagerMock.verify();
    });
    it('should set parent to not available if there are no children (null)', async () => {
      const product = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Track,
      });
      const parentProduct = ModelFactory.product({
        source: { availableForSubscription: true },
        productTypeId: ProductTypeIds.Album,
        childProductIds: null,
      });
      parentProductDaoMock.expects('find').never();
      parentProductDaoMock
        .expects('updateAvailableForSubscription')
        .withExactArgs(parentProduct.productId, false, context)
        .resolves(parentProduct);
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
      productPublishManagerMock.verify();
    });
    it('should set parent to not available if there are no children (empty array)', async () => {
      const product = ModelFactory.product({
        source: { availableForSubscription: false },
        productTypeId: ProductTypeIds.Track,
      });
      const parentProduct = ModelFactory.product({
        source: { availableForSubscription: true },
        productTypeId: ProductTypeIds.Album,
        childProductIds: [],
      });
      parentProductDaoMock.expects('find').never();
      parentProductDaoMock
        .expects('updateAvailableForSubscription')
        .withExactArgs(parentProduct.productId, false, context)
        .resolves(parentProduct);
      await parentProductManager.setParentSubscriptionAvailability(
        product,
        parentProduct,
        context,
      );
      parentProductDaoMock.verify();
      productPublishManagerMock.verify();
    });
  });
  describe('addChildToParent', () => {
    it('should call the dao method', async () => {
      const childId = 4512;
      const parentId = 1245;
      parentProductDaoMock
        .expects('push')
        .withExactArgs(parentId, 'childProductIds', childId, context)
        .resolves();
      await parentProductManager.addChildToParent(childId, parentId, context);
      parentProductDaoMock.verify();
    });
  });
});
