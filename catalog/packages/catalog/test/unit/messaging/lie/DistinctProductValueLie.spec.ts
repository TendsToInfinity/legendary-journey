import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { DistinctProductFieldPath } from '../../../../src/controllers/models/Product';
import {
  DistinctProductValueLie,
  DpvCombination,
} from '../../../../src/messaging/lie/DistinctProductValueLie';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('DistinctProductValueLie - Unit', () => {
  let dpvLie: DistinctProductValueLie;
  let mockBatchManager: sinon.SinonMock;
  let mockDistinctProductManager: sinon.SinonMock;
  let mockPtMan: sinon.SinonMock;
  let mockProductDao: sinon.SinonMock;
  let mockProductPublishManager: sinon.SinonMock;
  let mockLieLogger: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    dpvLie = new DistinctProductValueLie();
    mockBatchManager = sinon.mock((dpvLie as any).batchManager);
    mockPtMan = sinon.mock((dpvLie as any).productTypeManager);
    mockDistinctProductManager = sinon.mock(
      (dpvLie as any).distinctProductValueManager,
    );
    mockProductDao = sinon.mock((dpvLie as any).productDao);
    mockProductPublishManager = sinon.mock(
      (dpvLie as any).productPublishManager,
    );
    mockLieLogger = sinon.mock((dpvLie as any).logger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('dpvProcessHandler', () => {
    it('@slow run the update product with searching a source path from scheme', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productTypeGroupId = 'music';
      const distinctProduct = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        sourceValueName: 'Indie Pop',
        displayName: 'Pop',
        productTypeGroupId,
      });

      const expectedDpvCombination = {
        sourceValue: ['indie pop'],
        destinationValue: ['Pop'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId,
      } as DpvCombination;

      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId,
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };
      mockPtMan.expects('getProductTypes').resolves([productType]);
      mockProductDao
        .expects('getAllDistinctProductValueCombinations')
        .withExactArgs(
          'source.genres',
          distinctProduct.productTypeGroupId,
          distinctProduct.sourceValueName,
        )
        .resolves([['indie pop']]);

      mockDistinctProductManager
        .expects('getDistinctProductValuesByProductTypeGroupId')
        .withExactArgs(distinctProduct.productTypeGroupId)
        .resolves([distinctProduct]);

      mockBatchManager
        .expects('runPaginatedUpdateBatch')
        .withExactArgs([expectedDpvCombination], {
          table: 'product',
          idColumn: 'entity_id',
          idColumnToPropertyName: 'entityId',
          transform: sinon.match.func,
          sql: sinon.match.func,
        })
        .resolves([1]);
      const updatedProduct = ModelFactory.product({
        productId: 1,
        productTypeId: 'album',
      });
      mockProductDao.expects('findOne').withArgs(1).resolves(updatedProduct);
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(updatedProduct);

      await dpvLie.dpvProcessHandler(distinctProduct);
      sinon.verify();
    });

    it('run the update product with error in searching a source path from scheme', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productTypeGroupId = 'music';
      const distinctProduct = ModelFactory.distinctProductValue({
        fieldPath: 'meta.notgenres',
        sourceValueName: 'Indie Pop',
        displayName: 'Pop',
        productTypeGroupId,
      });

      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId,
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };

      mockPtMan.expects('getProductTypes').resolves([productType]);
      mockProductDao
        .expects('getAllDistinctProductValueCombinations')
        .withExactArgs(
          'source.genres',
          distinctProduct.productTypeGroupId,
          distinctProduct.sourceValueName,
        )
        .never();

      mockDistinctProductManager
        .expects('getDistinctProductValuesByProductTypeGroupId')
        .withExactArgs(distinctProduct.productTypeGroupId)
        .never();

      mockLieLogger
        .expects('error')
        .withExactArgs(
          `A source path for the Field Value not found. distinctProductValueId: ${distinctProduct.distinctProductValueId}`,
        );
      try {
        await dpvLie.dpvProcessHandler(distinctProduct);
      } catch (error) {
        expect(error.name).to.equal(Exception.InternalError.name);
        expect(error.errors).to.deep.equal([
          `A source path for the Field Value not found. distinctProductValueId: ${distinctProduct.distinctProductValueId}`,
        ]);
      }
      sinon.verify();
    });
    it('should not run an update if no DPV combinations are found', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productTypeGroupId = 'music';
      const distinctProduct = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        sourceValueName: 'Indie Pop',
        displayName: 'Pop',
        productTypeGroupId,
      });

      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId,
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };
      mockPtMan.expects('getProductTypes').resolves([productType]);
      mockProductDao
        .expects('getAllDistinctProductValueCombinations')
        .withExactArgs(
          'source.genres',
          distinctProduct.productTypeGroupId,
          distinctProduct.sourceValueName,
        )
        .resolves([]);

      mockDistinctProductManager
        .expects('getDistinctProductValuesByProductTypeGroupId')
        .withExactArgs(distinctProduct.productTypeGroupId)
        .resolves([]);

      mockBatchManager.expects('runPaginatedUpdateBatch').never();

      await dpvLie.dpvProcessHandler(distinctProduct);
      sinon.verify();
    });
    it('@slow runs update and handles batch sending rmq', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productTypeGroupId = 'music';
      const distinctProduct = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        sourceValueName: 'Indie Pop',
        displayName: 'Pop',
        productTypeGroupId,
      });

      const expectedDpvCombination = {
        sourceValue: ['indie pop'],
        destinationValue: ['Pop'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId,
      } as DpvCombination;

      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId,
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };

      const updatedProductIds = [...Array(200).keys()];

      mockPtMan.expects('getProductTypes').resolves([productType]);
      mockProductDao
        .expects('getAllDistinctProductValueCombinations')
        .withExactArgs(
          'source.genres',
          distinctProduct.productTypeGroupId,
          distinctProduct.sourceValueName,
        )
        .resolves([['indie pop']]);

      mockDistinctProductManager
        .expects('getDistinctProductValuesByProductTypeGroupId')
        .withExactArgs(distinctProduct.productTypeGroupId)
        .resolves([distinctProduct]);

      mockBatchManager
        .expects('runPaginatedUpdateBatch')
        .withExactArgs([expectedDpvCombination], {
          table: 'product',
          idColumn: 'entity_id',
          idColumnToPropertyName: 'entityId',
          transform: sinon.match.func,
          sql: sinon.match.func,
        })
        .resolves(updatedProductIds);

      updatedProductIds.forEach((productId) => {
        const updatedProduct = ModelFactory.product({
          productId: productId,
          productTypeId: 'album',
        });
        mockProductDao
          .expects('findOne')
          .withArgs(productId)
          .resolves(updatedProduct);
        mockProductPublishManager
          .expects('publishProductMessage')
          .withExactArgs(updatedProduct)
          .resolves();
      });

      await dpvLie.dpvProcessHandler(distinctProduct);
      sinon.verify();
    }).timeout(10000);
  });
});
