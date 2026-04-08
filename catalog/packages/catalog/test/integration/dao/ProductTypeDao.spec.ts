import { _ } from '@securustablets/libraries.utils';
import { assert } from 'chai';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductTypeDao - Integration', () => {
  let productTypeDao: ProductTypeDao;

  beforeEach(async () => {
    productTypeDao = new ProductTypeDao();
  });

  it('works for ProductTypeDao', async () => {
    const productType = await productTypeDao.findOneOrFail('movie');
    assert.equal(productType.jsonSchema.properties.purchaseCode.const, 'MOVIE');
    assert.equal(productType.productTypeId, 'movie');
  });
  it('works for ProductTypeDao all', async () => {
    const productTypes = await productTypeDao.find();
    productTypes.forEach((productType) => {
      assert.isDefined(productType.cdate, 'Missing udate');
      assert.isDefined(productType.productTypeId, 'Missing productTypeId');
      assert.isDefined(productType.udate, 'Missing udate');
    });
  });
  describe('caching', () => {
    it('caches find results', async () => {
      const productTypes = await productTypeDao.find();
      const movie = _.find(productTypes, (pt) => pt.productTypeId === 'movie');
      const updateMovie = _.cloneDeep(movie);
      updateMovie.meta = {
        ...movie.meta,
        displayName: `not ${_.get(movie, 'meta.displayName', 'displayName')}`,
      };
      await productTypeDao.update(
        updateMovie.productTypeId,
        updateMovie,
        ModelFactory.auditContext(),
      );
      const productTypes2 = await productTypeDao.find();
      assert.deepEqual(
        _.omit(
          _.find(productTypes2, (pt) => pt.productTypeId === 'movie'),
          'schema',
          'cdate',
          'udate',
        ),
        _.omit(movie, 'schema', 'cdate', 'udate'),
      );
    });
    it('does not cache find results with complex requests', async () => {
      const productTypes = await productTypeDao.find({
        customClauses: [
          { clause: "product_type_id != 'not_a_product_type532'", params: [] },
        ],
      });
      const movie = _.find(productTypes, (pt) => pt.productTypeId === 'movie');
      const updateMovie = _.cloneDeep(movie);
      updateMovie.meta = {
        ...movie.meta,
        displayName: `not ${_.get(movie, 'meta.displayName', 'displayName')}`,
      };
      await productTypeDao.update(
        updateMovie.productTypeId,
        updateMovie,
        ModelFactory.auditContext(),
      );
      const productTypes2 = await productTypeDao.find();
      assert.notDeepEqual(
        _.omit(
          _.find(productTypes2, (pt) => pt.productTypeId === 'movie'),
          'schema',
          'cdate',
          'udate',
        ),
        _.omit(movie, 'schema', 'cdate', 'udate'),
      );
    });
    it('caches findOneOrFail results', async () => {
      const movie = await productTypeDao.findOneOrFail('movie');
      const updateMovie = _.cloneDeep(movie);
      updateMovie.meta = {
        ...movie.meta,
        displayName: `not ${_.get(movie, 'meta.displayName', 'displayName')}`,
      };
      await productTypeDao.update(
        updateMovie.productTypeId,
        updateMovie,
        ModelFactory.auditContext(),
      );
      const movie2 = await productTypeDao.findOneOrFail('movie');
      assert.deepEqual(
        _.omit(movie2, 'cdate', 'udate'),
        _.omit(movie, 'cdate', 'udate'),
      );
    });
    it('does not cache find results with complex requests', async () => {
      const movie = await productTypeDao.findOneOrFail({
        by: { productTypeId: 'movie' },
      });
      const updateMovie = _.cloneDeep(movie);
      updateMovie.meta = {
        ...movie.meta,
        displayName: `not ${_.get(movie, 'meta.displayName', 'displayName')}`,
      };
      await productTypeDao.update(
        updateMovie.productTypeId,
        updateMovie,
        ModelFactory.auditContext(),
      );
      const movie2 = await productTypeDao.findOneOrFail('movie');
      assert.notDeepEqual(
        _.omit(movie2, 'cdate', 'udate'),
        _.omit(movie, 'cdate', 'udate'),
      );
    });
  });

  describe('update', () => {
    it('should update', async () => {
      const productType = await productTypeDao.findOneOrFail('movie');
      assert.equal(productType.productTypeId, 'movie');
      productType.meta.displayName = `not ${productType.meta.displayName}`;
      await productTypeDao.update(
        productType.productTypeId,
        productType,
        ModelFactory.auditContext(),
      );
      const updatedProductType = await productTypeDao.findOneOrFail({
        by: { productTypeId: 'movie' },
      });
      assert.equal(
        updatedProductType.meta.displayName,
        productType.meta.displayName,
      );
    });
    it('should throw on non-existing productType', async () => {
      const productType = {
        productTypeId: 'non-existing-product',
        meta: {
          displayName: 'cat',
          globalAvailability: false,
          telemetry: false,
          autoIngest: false,
          restrictedAccess: false,
        },
      };
      try {
        await productTypeDao.update(
          productType.productTypeId,
          productType,
          ModelFactory.auditContext(),
        );
        assert.fail();
      } catch (e) {
        assert.equal(e.code, 404);
        assert.include(
          e.errors,
          "No ProductType found matching { productTypeId: 'non-existing-product' }",
        );
      }
    });
  });
});
