import { SpLite } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { DistinctProductValue } from '../../../src/controllers/models/DistinctProductValue';
import {
  DistinctProductFieldPath,
  VendorNames,
} from '../../../src/controllers/models/Product';
import { DistinctProductValueManager } from '../../../src/lib/DistinctProductValueManager';
import { MessagingConstants } from '../../../src/messaging/MessagingConstants';
import { ModelFactory } from '../../utils/ModelFactory';

describe('DistinctProductValueManager - Unit', () => {
  const sandbox = sinon.createSandbox();
  let manager: DistinctProductValueManager;
  let mockDao: sinon.SinonMock;
  let mockBlockActionDao: sinon.SinonMock;
  let mockProductDao: sinon.SinonMock;
  let mockProductTypeDao: sinon.SinonMock;
  let mockMessagingManager: sinon.SinonMock;
  let mockAppConfig: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    manager = new DistinctProductValueManager();
    mockDao = sandbox.mock((manager as any).distinctProductValueDao);
    mockBlockActionDao = sandbox.mock((manager as any).blockActionDao);
    mockProductDao = sandbox.mock((manager as any).productDao);
    mockProductTypeDao = sandbox.mock((manager as any).productTypeDao);
    mockMessagingManager = sandbox.mock((manager as any).messagingManager);
    mockAppConfig = sandbox.mock((manager as any).appConfig);
    mockLogger = sinon.mock((manager as any).logger);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('updateBulk', () => {
    it('should update record group with given distinct product values and performs rmq publish', async () => {
      const displayName = faker.random.word();
      const distinctProductValues = [
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
        }),
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
        }),
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
        }),
      ];

      const updatedDistinctProductValues = _.cloneDeep(distinctProductValues);
      updatedDistinctProductValues.forEach((v) => {
        v.displayName = displayName;
      });

      mockDao
        .expects('find')
        .withExactArgs({
          ids: [
            distinctProductValues[0].distinctProductValueId,
            distinctProductValues[1].distinctProductValueId,
            distinctProductValues[2].distinctProductValueId,
          ],
        })
        .resolves(distinctProductValues);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          updatedDistinctProductValues[0].distinctProductValueId,
          updatedDistinctProductValues[0],
          {},
        )
        .resolves(updatedDistinctProductValues[0]);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          updatedDistinctProductValues[1].distinctProductValueId,
          updatedDistinctProductValues[1],
          {},
        )
        .resolves(updatedDistinctProductValues[1]);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          updatedDistinctProductValues[2].distinctProductValueId,
          updatedDistinctProductValues[2],
          {},
        )
        .resolves(updatedDistinctProductValues[2]);

      mockMessagingManager
        .expects('publish')
        .thrice()
        .withArgs(sinon.match.any)
        .resolves();

      const result = await manager.updateBulk(
        [
          distinctProductValues[0].distinctProductValueId,
          distinctProductValues[1].distinctProductValueId,
          distinctProductValues[2].distinctProductValueId,
        ],
        { displayName },
        {},
      );
      expect(result).to.deep.equal(updatedDistinctProductValues);
      sinon.verify();
    });

    it('should update record group with given distinct product values and performs sqs and blocklist action publish', async () => {
      const displayName = faker.random.word();
      const distinctProductValues = [
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
        }),
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
        }),
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
        }),
      ];

      const updatedDistinctProductValues = _.cloneDeep(distinctProductValues);
      updatedDistinctProductValues.forEach((v) => {
        v.displayName = displayName;
      });

      mockDao
        .expects('find')
        .withExactArgs({
          ids: [
            distinctProductValues[0].distinctProductValueId,
            distinctProductValues[1].distinctProductValueId,
            distinctProductValues[2].distinctProductValueId,
          ],
        })
        .resolves(distinctProductValues);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          updatedDistinctProductValues[0].distinctProductValueId,
          updatedDistinctProductValues[0],
          {},
        )
        .resolves(updatedDistinctProductValues[0]);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          updatedDistinctProductValues[1].distinctProductValueId,
          updatedDistinctProductValues[1],
          {},
        )
        .resolves(updatedDistinctProductValues[1]);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          updatedDistinctProductValues[2].distinctProductValueId,
          updatedDistinctProductValues[2],
          {},
        )
        .resolves(updatedDistinctProductValues[2]);

      mockMessagingManager
        .expects('publish')
        .thrice()
        .withArgs(sinon.match.any)
        .resolves();

      const result = await manager.updateBulk(
        [
          distinctProductValues[0].distinctProductValueId,
          distinctProductValues[1].distinctProductValueId,
          distinctProductValues[2].distinctProductValueId,
        ],
        { displayName },
        {},
      );
      expect(result).to.deep.equal(updatedDistinctProductValues);
      sinon.verify();
    });

    it('should update display name for single distinct product value and publish message to rmq for genre update', async () => {
      const displayName = faker.random.word();
      const dpv = ModelFactory.distinctProductValue({
        displayName: faker.random.word(),
        fieldPath: DistinctProductFieldPath.Genres,
      });
      const updatedDpv = _.clone(dpv);
      updatedDpv.displayName = displayName;

      mockDao
        .expects('find')
        .withExactArgs({ ids: [dpv.distinctProductValueId] })
        .resolves([dpv]);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(dpv.distinctProductValueId, updatedDpv, {})
        .resolves(updatedDpv);

      mockMessagingManager
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          `dpv.${dpv.productTypeGroupId}.updated`,
          updatedDpv,
        )
        .resolves();

      const result = await manager.updateBulk(
        [dpv.distinctProductValueId],
        { displayName },
        {},
      );
      expect(result).to.deep.equal([updatedDpv]);
      sinon.verify();
    });

    it('should throw a 400 for updating a non-genre fieldPath displayName', async () => {
      const displayName = faker.random.word();
      const dpv = ModelFactory.distinctProductValue({
        fieldPath: 'meta.notgenre',
        displayName: faker.random.word(),
      });
      const updatedDpv = _.clone(dpv);
      updatedDpv.displayName = displayName;

      mockDao
        .expects('find')
        .withExactArgs({ ids: [dpv.distinctProductValueId] })
        .resolves([dpv]);

      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(dpv.distinctProductValueId, updatedDpv, {})
        .resolves(updatedDpv);

      mockMessagingManager
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          `dpv.${dpv.productTypeGroupId}.updated`,
          updatedDpv,
        )
        .never();

      mockLogger
        .expects('error')
        .withExactArgs(
          `Invalid DPVs detected in update: ${JSON.stringify([dpv])}`,
        );

      try {
        await manager.updateBulk(
          [dpv.distinctProductValueId],
          { displayName },
          {},
        );
      } catch (error) {
        expect(error.code).to.equal(400);
        expect(error.errors[0]).to.have.keys([
          'message',
          'invalidUpdates',
          'dpvIds',
        ]);
      }
      sinon.verify();
    });

    it('should throw a 404 for unknown update IDs', async () => {
      const ids = [1, 1, 2, 3, 5];
      const foundDpv = ModelFactory.distinctProductValue({
        distinctProductValueId: 5,
      });
      mockDao
        .expects('find')
        .withExactArgs({ ids: [1, 2, 3, 5] })
        .resolves([foundDpv]);
      mockLogger
        .expects('error')
        .withExactArgs(`Invalid DPV IDs: ${JSON.stringify([1, 2, 3])}`);
      try {
        await manager.updateBulk(
          ids,
          { displayName: 'foo' },
          { apiKey: 'test' },
        );
      } catch (error) {
        expect(error.code).to.equal(404);
        expect(error.errors[0]).to.have.keys(['message', 'missingIds']);
      }
    });
  });

  describe('getOrCreateValueTableRecordsForField', () => {
    it('calls the distinctProductValueDao findByPathAndGroupAndSourceValue in parallel to get the distinct product value', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productTypeGroupId = 'music';

      const distinctProduct = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
        sourceValueName: 'ZERO',
      });
      const distinctProduct1 = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
        sourceValueName: 'one',
      });
      // same as distinctProduct except the sourceValueName being different in case.
      const distinctProduct2 = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
        sourceValueName: distinctProduct.sourceValueName.toLowerCase(),
        displayName: distinctProduct.displayName,
      });

      // distinctProduct3, distinctProduct4 - should be inserted into the DB with same sourceValueName and displayName.
      const distinctProduct3 = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
        sourceValueName: 'three',
      });
      const distinctProduct4 = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
        sourceValueName: 'four',
      });

      const genres = [
        distinctProduct.sourceValueName,
        distinctProduct1.sourceValueName,
        distinctProduct2.sourceValueName,
        distinctProduct3.sourceValueName,
        distinctProduct4.sourceValueName,
      ];
      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId,
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };
      const product = ModelFactory.productFromSchema(productType.jsonSchema, {
        source: {
          vendorName: VendorNames.AudibleMagic,
          genres: genres,
          productTypeId: 'album',
        },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          genres: ['random'],
        },
      });

      const schema = {
        path: 'source.genres',
        name: 'genres',
        distinctValue: 'meta.genres',
      } as SpLite;

      mockDao
        .expects('findByPathAndGroupAndSourceValue')
        .withExactArgs(
          distinctProduct.fieldPath,
          distinctProduct.productTypeGroupId,
          distinctProduct.sourceValueName,
        )
        .resolves([distinctProduct]);
      mockDao
        .expects('findByPathAndGroupAndSourceValue')
        .withExactArgs(
          distinctProduct1.fieldPath,
          distinctProduct1.productTypeGroupId,
          distinctProduct1.sourceValueName,
        )
        .resolves([distinctProduct1]);

      // resolves with distinctProduct, when the inputs are of distinctProduct2, as the dao find by is case insensitive.
      mockDao
        .expects('findByPathAndGroupAndSourceValue')
        .withExactArgs(
          distinctProduct2.fieldPath,
          distinctProduct2.productTypeGroupId,
          distinctProduct2.sourceValueName,
        )
        .resolves([distinctProduct]);

      mockDao
        .expects('findByPathAndGroupAndSourceValue')
        .withExactArgs(
          distinctProduct3.fieldPath,
          distinctProduct3.productTypeGroupId,
          distinctProduct3.sourceValueName,
        )
        .resolves(null);
      mockDao
        .expects('findByPathAndGroupAndSourceValue')
        .withExactArgs(
          distinctProduct4.fieldPath,
          distinctProduct4.productTypeGroupId,
          distinctProduct4.sourceValueName,
        )
        .resolves(undefined);

      const distinctProductValue = {
        fieldPath: distinctProduct2.fieldPath,
        productTypeGroupId: distinctProduct2.productTypeGroupId,
        sourceValueName: distinctProduct.sourceValueName.toLowerCase(),
      } as DistinctProductValue;

      mockDao
        .expects('createAndRetrieve')
        .withExactArgs(
          _.merge(distinctProductValue, {
            displayName: distinctProduct.displayName,
          }),
          {},
        )
        .once()
        .resolves(distinctProduct2);

      mockDao
        .expects('createAndRetrieve')
        .withExactArgs(
          _.merge(
            _.pick(
              distinctProduct3,
              'fieldPath',
              'productTypeGroupId',
              'sourceValueName',
            ),
            { displayName: distinctProduct3.sourceValueName },
          ),
          {},
        )
        .once()
        .resolves(distinctProduct3);

      mockDao
        .expects('createAndRetrieve')
        .withExactArgs(
          _.merge(
            _.pick(
              distinctProduct4,
              'fieldPath',
              'productTypeGroupId',
              'sourceValueName',
            ),
            { displayName: distinctProduct4.sourceValueName },
          ),
          {},
        )
        .once()
        .resolves(distinctProduct4);

      const result = await manager.getOrCreateValueTableRecordsForField(
        schema,
        product,
        {},
      );
      expect(Object.keys(result['meta.genres']).length).to.equal(4);
      expect(Object.keys(result['meta.genres']).sort()).to.deep.equal(
        _.filter(genres, (i) => i !== 'zero').sort(),
      );
      sinon.verify();
    });
    it('should not normalize lcase any sourceValueName except genre', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productTypeGroupId = 'music';

      const categoryDpv = ModelFactory.distinctProductValue({
        fieldPath: 'meta.categories',
        productTypeGroupId,
        sourceValueName: 'FooBar',
      });

      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId,
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };
      const product = ModelFactory.productFromSchema(productType.jsonSchema, {
        source: {
          vendorName: VendorNames.AudibleMagic,
          productTypeId: 'album',
        },
        meta: { categories: [categoryDpv.sourceValueName] },
      });

      const schema = {
        path: 'meta.categories',
        name: 'categories',
        distinctValue: 'meta.categories',
      } as SpLite;

      mockDao
        .expects('findByPathAndGroupAndSourceValue')
        .twice()
        .withExactArgs(
          categoryDpv.fieldPath,
          categoryDpv.productTypeGroupId,
          categoryDpv.sourceValueName,
        )
        .resolves(undefined);

      mockDao
        .expects('createAndRetrieve')
        .once()
        .withExactArgs(
          _.merge(
            _.pick(
              categoryDpv,
              'fieldPath',
              'productTypeGroupId',
              'sourceValueName',
            ),
            { displayName: categoryDpv.sourceValueName },
          ),
          {},
        )
        .resolves(categoryDpv);

      await manager.getOrCreateValueTableRecordsForField(schema, product, {});
      sinon.verify();
    });
  });

  describe('getDistinctProductValuesByProductTypeGroupId', () => {
    it('calls the getDistinctProductValuesByProductTypeGroupId to get the distinct product values by groupId', async () => {
      const productTypeGroupId = 'music';

      const distinctProduct = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
      });
      const distinctProduct1 = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId,
      });
      mockDao
        .expects('find')
        .withExactArgs({ by: { productTypeGroupId } })
        .resolves([distinctProduct, distinctProduct1]);

      const result = await manager.getDistinctProductValuesByProductTypeGroupId(
        distinctProduct.productTypeGroupId,
      );
      expect(result).to.deep.equal([distinctProduct, distinctProduct1]);

      sinon.verify();
    });
  });
});
