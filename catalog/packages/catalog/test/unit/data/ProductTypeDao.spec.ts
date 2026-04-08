import { assert, expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { ProductType } from '../../../src/lib/models/ProductType';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductTypeDao - Unit', () => {
  let productTypeDao: ProductTypeDao;
  let mockRuleDao: sinon.SinonMock;

  beforeEach(() => {
    productTypeDao = new ProductTypeDao();
    mockRuleDao = sinon.mock((productTypeDao as any).ruleDao);
  });
  afterEach(() => {
    sinon.restore();
    mockRuleDao.restore();
  });
  describe('construct', () => {
    it('constructs', () => {
      assert.isObject(productTypeDao, 'It did not construct');
    });
  });
  describe('findAll', () => {
    it('should call _find', async () => {
      const productTypes = [
        ModelFactory.productType(),
        ModelFactory.productType(),
      ];
      const findStub = sinon
        .stub(productTypeDao as any, '_find')
        .resolves(productTypes);

      const result1 = await productTypeDao.findAll();

      expect(result1).to.deep.equal(productTypes);
      expect(findStub.callCount).to.equal(1);
    });
  });
  describe('find', () => {
    it('should call findAll when options are not provided', async () => {
      const productTypes = [
        ModelFactory.productType(),
        ModelFactory.productType(),
      ];
      const findAllStub = sinon
        .stub(productTypeDao as any, 'findAll')
        .resolves(productTypes);

      const result1 = await productTypeDao.find();

      expect(result1).to.deep.equal(productTypes);
      expect(findAllStub.callCount).to.equal(1);
    });
    it('should call findAll when options are empty', async () => {
      const productTypes = [
        ModelFactory.productType(),
        ModelFactory.productType(),
      ];
      const findAllStub = sinon
        .stub(productTypeDao as any, 'findAll')
        .resolves(productTypes);

      const result1 = await productTypeDao.find({});

      expect(result1).to.deep.equal(productTypes);
      expect(findAllStub.callCount).to.equal(1);
    });
    it('should call _find when options are provided', async () => {
      const productTypes = [
        ModelFactory.productType(),
        ModelFactory.productType(),
      ];
      const findStub = sinon
        .stub(productTypeDao as any, '_find')
        .resolves(productTypes);
      const findAllStub = sinon
        .stub(productTypeDao as any, 'findAll')
        .resolves(productTypes);

      const result1 = await productTypeDao.find({
        by: { productTypeId: 'gah' },
      });

      expect(result1).to.deep.equal(productTypes);

      expect(findStub.callCount).to.equal(1);
      expect(findAllStub.callCount).to.equal(0);
    });
  });
  describe('findById', () => {
    it('should call findAll', async () => {
      const productTypes = [
        ModelFactory.productType({ productTypeId: 'game' }),
        ModelFactory.productType({ productTypeId: 'movie' }),
      ];
      const findAllStub = sinon
        .stub(productTypeDao as any, 'findAll')
        .resolves(productTypes);

      const result1 = await productTypeDao.findById('movie');

      expect(result1).to.deep.equal(productTypes[1]);
      expect(findAllStub.callCount).to.equal(1);
    });
  });
  describe('findByIdOrFail', () => {
    it('should call findById and return the result', async () => {
      const productType = ModelFactory.productType();
      const findByIdStub = sinon
        .stub(productTypeDao as any, 'findById')
        .resolves(productType);

      const result = await productTypeDao.findByIdOrFail('movie');

      expect(result).to.deep.equal(productType);
      expect(findByIdStub.callCount).to.equal(1);
    });
    it("should throw an exception if findById doens't find anything", async () => {
      const productTypeId = 'movie';
      const findByIdStub = sinon
        .stub(productTypeDao as any, 'findById')
        .resolves(undefined);

      try {
        await productTypeDao.findByIdOrFail(productTypeId);
        expect.fail();
      } catch (e) {
        expect(e.name).to.equal(Exception.NotFound.name);
        expect(e.errors).to.deep.equal([
          `No ProductType found matching { productTypeId: '${productTypeId}' }`,
        ]);
      }

      expect(findByIdStub.callCount).to.equal(1);
    });
  });
  describe('findOneOrFail', () => {
    it('should call findByIdOrFail if productTypeId is provided', async () => {
      const productType = ModelFactory.productType();
      const findByIdOrFailStub = sinon
        .stub(productTypeDao as any, 'findByIdOrFail')
        .resolves(productType);
      const findOneOrFailStub = sinon
        .stub(productTypeDao as any, '_findOneOrFail')
        .resolves(productType);

      const result1 = await productTypeDao.findOneOrFail('movie');

      expect(result1).to.deep.equal(productType);
      expect(findByIdOrFailStub.callCount).to.equal(1);
      expect(findOneOrFailStub.callCount).to.equal(0);
    });
    it('should call _findOneOrFail if FindOneOptions are provided', async () => {
      const productType = ModelFactory.productType();
      const findByIdOrFailStub = sinon
        .stub(productTypeDao as any, 'findByIdOrFail')
        .resolves(productType);
      const findOneOrFailStub = sinon
        .stub(productTypeDao as any, '_findOneOrFail')
        .resolves(productType);

      const result1 = await productTypeDao.findOneOrFail({
        contains: { bob: '23' },
      });

      expect(result1).to.deep.equal(productType);
      expect(findByIdOrFailStub.callCount).to.equal(0);
      expect(findOneOrFailStub.callCount).to.equal(1);
    });
  });
  describe('findByContext', () => {
    it('should apply rules', async () => {
      const rawProductTypes = [
        ModelFactory.productType({ productTypeId: 'stamps', available: false }),
        ModelFactory.productType({ productTypeId: 'cars', available: false }),
      ];
      const findStub = sinon
        .stub(productTypeDao as any, '_find')
        .returns(rawProductTypes);

      mockRuleDao
        .expects('findSetByContext')
        .once()
        .withArgs(
          { customerId: 'customerId', siteId: 'siteId' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            productTypeId: 'stamps',
            customerId: 'customerId',
            siteId: 'siteId',
            action: { available: true },
          },
          {
            productTypeId: 'cars',
            customerId: 'customerId',
            action: { available: true },
          },
        ]);
      mockRuleDao
        .expects('findSetByContext')
        .once()
        .withArgs(
          { customerId: 'customerId2', siteId: 'siteId2' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            productTypeId: 'stamps',
            customerId: 'customerId2',
            siteId: 'siteId2',
            action: { available: true },
          },
          {
            productTypeId: 'cars',
            customerId: 'customerId2',
            action: { available: true },
          },
        ]);

      const productTypes1 = await productTypeDao.findByContext({
        customerId: 'customerId',
        siteId: 'siteId',
      });
      const productTypes2 = await productTypeDao.findByContext({
        customerId: 'customerId2',
        siteId: 'siteId2',
      });
      mockRuleDao.verify();

      expect(productTypes1).to.deep.equal(
        rawProductTypes.map((rawProductType) => ({
          ...rawProductType,
          available: true,
        })),
      );
      expect(productTypes2).to.deep.equal(
        rawProductTypes.map((rawProductType) => ({
          ...rawProductType,
          available: true,
        })),
      );

      expect(findStub.callCount).to.equal(2);
    });
  });
  describe('findOneOrFailByContext', () => {
    it('should apply rules', async () => {
      const rawProductTypes = [
        ModelFactory.productType({ productTypeId: 'stamps', available: false }),
        ModelFactory.productType({ productTypeId: 'cars', available: false }),
      ];
      sinon.stub(productTypeDao as any, '_find').returns(rawProductTypes);

      mockRuleDao
        .expects('findSetByContext')
        .withArgs(
          { customerId: 'customerId', siteId: 'siteId' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            productTypeId: 'stamps',
            customerId: 'customerId',
            siteId: 'siteId',
            action: { available: true },
          },
          {
            productTypeId: 'stamps',
            customerId: 'customerId',
            action: { available: false },
          },
        ]);
      const productTypes = await productTypeDao.findOneOrFailByContext(
        'stamps',
        { customerId: 'customerId', siteId: 'siteId' },
      );
      mockRuleDao.verify();
      expect(productTypes).to.deep.equal({
        ...rawProductTypes[0],
        available: true,
      });
    });
  });
  describe('findAvailabilityOrFail', () => {
    let rawProductTypes: ProductType[];

    beforeEach(() => {
      rawProductTypes = [
        ModelFactory.productType({ productTypeId: 'stamps', available: false }),
        ModelFactory.productType({ productTypeId: 'cars', available: false }),
      ];
      sinon.stub(productTypeDao as any, '_find').returns(rawProductTypes);
    });

    it('should apply rules (site context with customer parent)', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(
          { customerId: 'customerId', siteId: 'siteId' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            ruleId: 2,
            productTypeId: 'stamps',
            customerId: 'customerId',
            action: { available: true },
          },
          {
            ruleId: 1,
            productTypeId: 'stamps',
            customerId: 'customerId',
            siteId: 'siteId',
            action: { available: true },
          },
        ]);
      const availability = await productTypeDao.findAvailabilityOrFail(
        'stamps',
        { customerId: 'customerId', siteId: 'siteId' },
      );
      mockRuleDao.verify();
      expect(availability).to.deep.equal({
        available: true,
        ruleId: 1,
        inherited: false,
        parent: { available: true },
      });
    });
    it('should apply rules (site context with global parent)', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(
          { customerId: 'customerId', siteId: 'siteId' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            ruleId: 1,
            productTypeId: 'stamps',
            customerId: 'customerId',
            siteId: 'siteId',
            action: { available: true },
          },
        ]);
      const availability = await productTypeDao.findAvailabilityOrFail(
        'stamps',
        { customerId: 'customerId', siteId: 'siteId' },
      );
      mockRuleDao.verify();
      expect(availability).to.deep.equal({
        available: true,
        ruleId: 1,
        inherited: false,
        parent: { available: false },
      });
    });
    it('should apply rules (site context with no matching rules)', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(
          { customerId: 'customerId', siteId: 'siteId' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            ruleId: 1,
            productTypeId: 'not stamps',
            customerId: 'customerId',
            siteId: 'siteId',
            action: { available: true },
          },
          {
            ruleId: 2,
            productTypeId: 'not stamps',
            customerId: 'customerId',
            action: { available: false },
          },
        ]);
      const availability = await productTypeDao.findAvailabilityOrFail(
        'stamps',
        { customerId: 'customerId', siteId: 'siteId' },
      );
      mockRuleDao.verify();
      expect(availability).to.deep.equal({
        available: false,
        inherited: true,
        ruleId: undefined,
        parent: { available: false },
      });
    });
    it('should apply rules (customer context with global parent)', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(
          { customerId: 'customerId' },
          RuleType.ProductTypeAvailability,
        )
        .resolves([
          {
            ruleId: 1,
            productTypeId: 'stamps',
            customerId: 'customerId',
            action: { available: true },
          },
        ]);
      const availability = await productTypeDao.findAvailabilityOrFail(
        'stamps',
        { customerId: 'customerId' },
      );
      mockRuleDao.verify();
      expect(availability).to.deep.equal({
        available: true,
        ruleId: 1,
        inherited: false,
        parent: { available: false },
      });
    });
    it('should apply rules (global/empty context)', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(
          { customerId: undefined, siteId: undefined },
          RuleType.ProductTypeAvailability,
        )
        .resolves([]);
      const availability = await productTypeDao.findAvailabilityOrFail(
        'stamps',
        { customerId: undefined, siteId: undefined },
      );
      mockRuleDao.verify();
      expect(availability).to.deep.equal({
        available: false,
        inherited: false,
        ruleId: undefined,
        parent: undefined,
      });
    });
    it('should apply rules (global/undefined context)', async () => {
      mockRuleDao
        .expects('findSetByContext')
        .withArgs(undefined, RuleType.ProductTypeAvailability)
        .resolves([]);
      const availability =
        await productTypeDao.findAvailabilityOrFail('stamps');
      mockRuleDao.verify();
      expect(availability).to.deep.equal({
        available: false,
        inherited: false,
        ruleId: undefined,
        parent: undefined,
      });
    });
  });
});
