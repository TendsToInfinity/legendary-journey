import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { DistinctProductFieldPath } from '../../../src/controllers/models/Product';
import { DistinctProductValueDao } from '../../../src/data/PGCatalog/DistinctProductValueDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('DistinctProductValueDao - Unit', () => {
  let dao: DistinctProductValueDao;
  let pgMock: sinon.SinonMock;

  beforeEach(() => {
    dao = new DistinctProductValueDao();
    pgMock = MockUtils.inject(dao, '_pg', Postgres);
  });

  describe('construct', () => {
    it('constructs', () => {
      const distinctProductValueDao = new DistinctProductValueDao();
      assert.isObject(distinctProductValueDao, 'It did not construct');
    });
  });

  it('should find', async () => {
    const distinctProductValue = ModelFactory.distinctProductValue();
    const options = { by: { distinctProductValueId: 1 } } as any;

    const find = sinon.stub(dao as any, 'find').resolves(distinctProductValue);

    const result = await dao.find(options);

    assert(find.calledOnce);
    assert(find.calledOnceWithExactly(options));
    expect(result).to.deep.equal(distinctProductValue);
  });

  describe('findByPathAndGroupAndSourceValue', () => {
    it('invokes find and returns single distinct product value', async () => {
      const distinctProduct = ModelFactory.distinctProductValue();

      const findStub = sinon
        .stub(dao as any, 'find')
        .withArgs({
          by: {
            fieldPath: distinctProduct.fieldPath,
            productTypeGroupId: distinctProduct.productTypeGroupId,
            sourceValueName: distinctProduct.sourceValueName,
          },
        })
        .resolves(distinctProduct);

      const result = await dao.findByPathAndGroupAndSourceValue(
        distinctProduct.fieldPath,
        distinctProduct.productTypeGroupId,
        distinctProduct.sourceValueName,
      );

      assert(findStub.calledOnce);
      expect(result).to.deep.equal(distinctProduct);
    });
    it('invokes find and does not return any future product', async () => {
      const findStub = sinon.stub(dao as any, 'find').resolves();
      const result = await dao.findByPathAndGroupAndSourceValue(
        DistinctProductFieldPath.Genres,
        'music',
        faker.random.word(),
      );

      assert(findStub.calledOnce);
      expect(result).to.deep.equal(undefined);
    });
  });

  describe('getDistinctDisplayForValueAndProductType', () => {
    it('distinct values returned using query to fetch either displayName or sourceValueName', async () => {
      const fieldPath = ModelFactory.fakeDistinctProductFieldPaths;
      const productType = ModelFactory.fakeProductTypes;
      const results = [
        { displayName: faker.random.word() },
        { displayName: faker.random.word() },
        { displayName: faker.random.word() },
      ];
      pgMock
        .expects('query')
        .withExactArgs(
          `SELECT DISTINCT display_name FROM distinct_product_value WHERE field_path = $1 AND product_type_group_id = $2`,
          [fieldPath, productType],
        )
        .resolves({ rows: results });

      const result = await dao.getDistinctDisplayForValueAndProductType(
        fieldPath,
        productType,
      );
      expect(result).to.deep.equal(_.map(results, 'displayName'));
      pgMock.verify();
    });
    it('uses query to fetch either displayName or sourceValueName and returns empty values', async () => {
      const fieldPath = ModelFactory.fakeDistinctProductFieldPaths;
      const productType = ModelFactory.fakeProductTypes;

      pgMock
        .expects('query')
        .withExactArgs(
          `SELECT DISTINCT display_name FROM distinct_product_value WHERE field_path = $1 AND product_type_group_id = $2`,
          [fieldPath, productType],
        )
        .resolves({ rows: [] });

      const result = await dao.getDistinctDisplayForValueAndProductType(
        fieldPath,
        productType,
      );
      expect(result).to.deep.equal([]);
      pgMock.verify();
    });
  });
});
