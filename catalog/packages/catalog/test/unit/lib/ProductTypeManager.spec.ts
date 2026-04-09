import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductTypeIds } from '../../../src/controllers/models/Product';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ProductTypeManager } from '../../../src/lib/ProductTypeManager';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductTypeManager - Unit', () => {
  let manager: ProductTypeManager;
  let mockProductTypeDao: sinon.SinonMock;
  let mockDistinctProductValueDao: sinon.SinonMock;
  let mockRuleDao: sinon.SinonMock;
  let mockConfig: sinon.SinonMock;

  beforeEach(() => {
    manager = Container.get(ProductTypeManager);
    mockProductTypeDao = sinon.mock((manager as any).productTypeDao);
    mockDistinctProductValueDao = sinon.mock(
      (manager as any).distinctProductValueDao,
    );
    mockRuleDao = sinon.mock((manager as any).ruleDao);
    mockConfig = sinon.mock((manager as any).config);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getProductType', () => {
    it('calls the productTypeDao', async () => {
      mockProductTypeDao
        .expects('findOneOrFailByContext')
        .withArgs('ferrari')
        .resolves(ModelFactory.productType());
      await manager.getProductType('ferrari');
      mockProductTypeDao.verify();
    });
  });

  describe('getProductTypes', () => {
    it('calls the productTypeDao', async () => {
      mockProductTypeDao
        .expects('findByContext')
        .resolves(ModelFactory.productType());
      await manager.getProductTypes();
      mockProductTypeDao.verify();
    });
    it('should disable music subscription if local media config set', async () => {
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      mockProductTypeDao.expects('findByContext').resolves(
        _.range(10).map(() =>
          ModelFactory.productType({
            productTypeId: ProductTypeIds.MusicSubscription,
          }),
        ),
      );
      const result = await manager.getProductTypes({
        inmateJwt: SecurityFactory.inmateJwt({
          customerId: 'customerId',
          siteId: 'siteId',
        }),
      } as any);
      expect(result[0].available).to.be.false;
      sinon.verify();
    });
    it('should not disable music subscription if local media config set false', async () => {
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: false });
      mockProductTypeDao.expects('findByContext').resolves(
        _.range(10).map(() =>
          ModelFactory.productType({
            productTypeId: ProductTypeIds.MusicSubscription,
          }),
        ),
      );
      const result = await manager.getProductTypes({
        inmateJwt: SecurityFactory.inmateJwt({
          customerId: 'customerId',
          siteId: 'siteId',
        }),
      } as any);
      expect(result[0].available).to.be.true;
      sinon.verify();
    });
  });
  describe('isProductTypeAvailableForContext', () => {
    const siteId = '90210';
    const customerId = 'I-024601';
    const type = RuleType.ProductTypeAvailability;
    const whitelist = { available: true };
    const blacklist = { available: false };
    const productTypeId = 'track';
    const context = { customerId, siteId };
    it('should return false if there are no rules', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves([]);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(false);
      mockRuleDao.verify();
    });
    it('should not consider rules for the wrong productType', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves([
          ModelFactory.rule({
            customerId,
            type,
            action: whitelist,
            productTypeId: 'album',
          }),
        ]);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(false);
      mockRuleDao.verify();
    });
    it('should return true if there is a customer WL', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves([
          ModelFactory.rule({
            customerId,
            type,
            action: whitelist,
            productTypeId,
          }),
        ]);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(true);
      mockRuleDao.verify();
    });
    it('should return false if there is a customer BL', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves([
          ModelFactory.rule({
            customerId,
            type,
            action: blacklist,
            productTypeId,
          }),
        ]);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(false);
      mockRuleDao.verify();
    });
    it('should return true if there is a site WL and no customer rule', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves([
          ModelFactory.rule({
            customerId,
            siteId,
            type,
            action: whitelist,
            productTypeId,
          }),
        ]);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(true);
      mockRuleDao.verify();
    });
    it('should return false if there is a site BL and no customer rule', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves([
          ModelFactory.rule({
            customerId,
            siteId,
            type,
            action: blacklist,
            productTypeId,
          }),
        ]);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(false);
      mockRuleDao.verify();
    });
    it('should return true if there is a customer BL and a site WL', async () => {
      const srcRules = [
        ModelFactory.rule({
          customerId,
          type,
          action: blacklist,
          productTypeId,
        }),
        ModelFactory.rule({
          customerId,
          siteId,
          type,
          action: whitelist,
          productTypeId,
        }),
      ];
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves(srcRules);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(true);
      mockRuleDao.verify();
    });
    it('should return false if there is a customer WL and a site BL', async () => {
      const srcRules = [
        ModelFactory.rule({
          customerId,
          type,
          action: whitelist,
          productTypeId,
        }),
        ModelFactory.rule({
          customerId,
          siteId,
          type,
          action: blacklist,
          productTypeId,
        }),
      ];
      mockRuleDao
        .expects('findSetByContext')
        .withExactArgs(context, type)
        .resolves(srcRules);
      expect(
        await manager.isProductTypeAvailableForContext(productTypeId, {
          customerId,
          siteId,
        }),
      ).to.equal(false);
      mockRuleDao.verify();
    });
  });
  describe('getProductTypeAggregations', () => {
    const simpleSchema = {
      type: 'object',
      properties: {
        aString: {
          autoComplete: true,
          type: 'string',
        },
        aObject: {
          type: 'object',
          properties: {
            aObjEnumArray: {
              autoComplete: true,
              enum: ['liger', 'lion', 'tiger'],
              type: 'string',
            },
          },
        },
        bObject: {
          type: 'array',
          items: {
            type: 'number',
          },
          keyField: true,
          autoComplete: true,
          requiredIfActive: true,
          distinctValue: 'properties.bObject',
        },
        cObject: {
          type: 'array',
          items: {
            type: 'string',
          },
          keyField: true,
          autoComplete: true,
          requiredIfActive: true,
          distinctValue: 'properties.cObject',
        },
        dObject: {
          type: 'array',
          items: {
            type: 'string',
          },
          keyField: true,
          requiredIfActive: true,
          distinctValue: 'properties.dObject',
        },
        eObject: {
          type: 'object',
          properties: {
            eObjectNumber: {
              type: 'number',
              keyField: true,
              autoComplete: true,
              distinctValue: 'properties.eObject.eObjectNumber',
              requiredIfActive: true,
            },
          },
        },
      },
    };
    it('does not query data for enums', async () => {
      const productType = {
        ...ModelFactory.productType(),
        jsonSchema: simpleSchema,
      };
      mockProductTypeDao.expects('findOneOrFail').resolves(productType);
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('aString', productType.productTypeId)
        .resolves(['who', 'cares']);
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('bObject', productType.productTypeId)
        .resolves(['1.5', '2.5']);
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('cObject', productType.productTypeId)
        .resolves(['whoC', 'caresC']);
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('eObject.eObjectNumber', productType.productTypeId)
        .resolves(['5']);
      const response = await manager.getProductTypeAggregations(
        productType.productTypeId,
      );

      let enumField = _.find(response.fields, ['name', 'aObjEnumArray']);
      expect(enumField.values.sort()).to.deep.equal(
        ['liger', 'lion', 'tiger'].sort(),
        'Enum values do not match',
      );
      enumField = _.find(response.fields, ['name', 'aString']);
      expect(enumField.values.sort()).to.deep.equal(
        ['who', 'cares'].sort(),
        'values do not match from db',
      );
      enumField = _.find(response.fields, ['name', 'bObject']);
      expect(enumField.values.sort()).to.deep.equal(
        [1.5, 2.5].sort(),
        'values do not match from db',
      );
      enumField = _.find(response.fields, ['name', 'cObject']);
      expect(enumField.values.sort()).to.deep.equal(
        ['whoC', 'caresC'].sort(),
        'values do not match from db',
      );
      enumField = _.find(response.fields, ['name', 'eObjectNumber']);
      expect(enumField.values.sort()).to.deep.equal(
        [5].sort(),
        'values do not match from db',
      );
      sinon.verify();
    });
    it('quietly swallows lookup errors and returns []', async () => {
      const productType = {
        ...ModelFactory.productType(),
        jsonSchema: simpleSchema,
      };
      mockProductTypeDao.expects('findOneOrFail').resolves(productType);
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('aString', productType.productTypeId)
        .rejects(Exception.InternalError());
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('bObject', productType.productTypeId)
        .resolves(['1.5', '2.5']);
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('cObject', productType.productTypeId)
        .rejects(Exception.InternalError());
      mockDistinctProductValueDao
        .expects('getDistinctDisplayForValueAndProductType')
        .withExactArgs('eObject.eObjectNumber', productType.productTypeId)
        .resolves(['5']);
      const response = await manager.getProductTypeAggregations(
        productType.productTypeId,
      );
      let enumField = _.find(response.fields, ['name', 'aString']);
      expect(enumField.values).to.deep.equal([], 'Values do not match');

      enumField = _.find(response.fields, ['name', 'bObject']);
      expect(enumField.values.sort()).to.deep.equal(
        [1.5, 2.5].sort(),
        'values do not match from db',
      );

      enumField = _.find(response.fields, ['name', 'cObject']);
      expect(enumField.values).to.deep.equal([], 'Values do not match');

      enumField = _.find(response.fields, ['name', 'eObjectNumber']);
      expect(enumField.values.sort()).to.deep.equal(
        [5].sort(),
        'values do not match from db',
      );

      sinon.verify();
    });
  });
  describe('getValueFromJsonSchemaByFieldName', () => {
    it('get the value of the field productTypeGroupId', async () => {
      const productType = ModelFactory.productType();
      const result = await manager.getValueFromJsonSchemaByFieldName(
        productType,
        'productTypeGroupId',
      );
      expect(result).to.deep.equal(['movie']);
    });
    it('get null value if the field does not exists', async () => {
      const productType = ModelFactory.productType();
      const result = await manager.getValueFromJsonSchemaByFieldName(
        productType,
        'snowfield',
      );
      expect(result).to.deep.equal([]);
    });
    it('should return the const when schema.enum is not present', async () => {
      const productType = ModelFactory.productType();
      productType.jsonSchema.properties.status = {
        type: 'string',
        const: 'Active',
      };
      delete productType.jsonSchema.properties.status.enum;

      const result = await manager.getValueFromJsonSchemaByFieldName(
        productType,
        'status',
      );

      expect(result).to.deep.equal(['Active']);
    });
  });
  describe('isFieldExistPartOfSchema', () => {
    it('should return true for the field productTypeGroupId ', async () => {
      const productType = ModelFactory.productType();
      const result = await manager.isFieldPartOfSchema(
        productType,
        'productTypeGroupId',
      );
      expect(result).to.deep.equal(true);
    });
    it('should return false for the field that does not exists', async () => {
      const productType = ModelFactory.productType();
      const result = await manager.isFieldPartOfSchema(
        productType,
        'nonExistingField',
      );
      expect(result).to.deep.equal(false);
    });
  });
});
