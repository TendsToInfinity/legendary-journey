import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { Product } from '../../../src/controllers/models/Product';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductDao - Integration', () => {
  let productDao: ProductDao;

  before(() => {
    CatalogService.bindAll();
  });
  beforeEach(() => {
    productDao = new ProductDao();
  });
  describe('create', async () => {
    it('creates a product', async () => {
      const productTypeDao = new ProductTypeDao();
      const productType = await productTypeDao.findOneOrFail('movie');
      const faked = ModelFactory.productFromSchema(productType.jsonSchema);
      const createdId = await productDao.create(faked, { apiKey: 'test' });
      const product = await productDao.findOneOrFail(createdId);
      assert.isNumber(createdId, 'wrong creation id');
      assert.isString(product.meta.name, 'missing product name');
      assert.isOk(product.cdate, 'missing cdate');
      assert.isOk(product.udate, 'missing udate');
      assert.equal(product.version, 1, 'wrong product version');
    });
  });
  describe('findDescendantProductIds', () => {
    let productIds: number[];
    beforeEach(async () => {
      const grandchildProductId = await productDao.create(
        ModelFactory.product(),
        { apiKey: 'test' },
      );
      const child1ProductId = await productDao.create(
        ModelFactory.product({ childProductIds: [grandchildProductId] }),
        { apiKey: 'test' },
      );
      const child2ProductId = await productDao.create(ModelFactory.product(), {
        apiKey: 'test',
      });
      const productId = await productDao.create(
        ModelFactory.product({
          childProductIds: [child1ProductId, child2ProductId],
        }),
        { apiKey: 'test' },
      );
      productIds = [
        productId,
        child1ProductId,
        child2ProductId,
        grandchildProductId,
      ];
    });
    it('finds descendant product ids', async () => {
      const result = await productDao.findDescendantProductIds(productIds[0]);

      expect(result).to.deep.equal(productIds.sort((a, b) => a - b));
    });
  });
  describe('findDistinctForSchema', () => {
    beforeEach(async () => {
      const products: Product[] = [
        ModelFactory.productFromSchema(ModelFactory.testSchema(), {
          productTypeId: 'ferrari',
          aStringArray: ['one', 'two', 'three'],
          aEnumArray: ['should', 'not', 'matter'],
          aObject: {
            aObjArrayObjects: [
              {
                name: 'why not',
                data: [{ foo: 'bar', bar: ['eins', 'zwei', 'drei'] }],
              },
            ],
            price: {
              rental: 1.99,
            },
          },
        }),
        ModelFactory.productFromSchema(ModelFactory.testSchema(), {
          productTypeId: 'ferrari',
          aStringArray: ['five', 'eight', 'thirteen'],
          aEnumArray: ['should', 'not', 'matter'],
          aObject: {
            aObjArrayObjects: [
              {
                name: 'get jiggy',
                data: [{ foo: 'bas', bar: ['vier', 'funf', 'sechs'] }],
              },
            ],
            price: {
              rental: 1.99,
            },
          },
        }),
        ModelFactory.productFromSchema(ModelFactory.testSchema(), {
          productTypeId: 'ferrari',
          aStringArray: ['twentyOne', 'thirtyFour', 'fiftyFive'],
          aEnumArray: ['should', 'not', 'matter'],
          aObject: {
            aObjArrayObjects: [
              {
                name: 'with it?',
                data: [{ foo: 'bat', bar: ['sieben', 'acht', 'neun'] }],
              },
            ],
            price: {
              rental: 19.99,
            },
          },
        }),
      ];
      await Promise.all(
        _.map(products, (p) => productDao.create(p, { apiKey: 'test' })),
      );
    });
    it('gets correct list for stringArray field', async () => {
      const schema = new JsonSchemaParser(ModelFactory.testSchema());
      const values = await productDao.findDistinctForSchema(
        'ferrari',
        schema.getSchema('aStringArray'),
      );
      assert.equal(values.length, 9, 'Wrong number of values returned');
      expect(values).to.include.members([
        'one',
        'two',
        'three',
        'five',
        'eight',
        'thirteen',
        'twentyOne',
        'thirtyFour',
        'fiftyFive',
      ]);
    });
    it('gets nested object.object.number', async () => {
      const schema = new JsonSchemaParser(ModelFactory.testSchema());
      const values = await productDao.findDistinctForSchema(
        'ferrari',
        schema.getSchema('aObject.price.rental'),
      );
      assert.equal(values.length, 2, 'Wrong number of values returned');
      expect(values).to.include.members([1.99, 19.99]);
    });
    it('gets nested object.arrayOfObject.arrayOfObjects.array', async () => {
      const schema = new JsonSchemaParser(ModelFactory.testSchema());
      const values = await productDao.findDistinctForSchema(
        'ferrari',
        schema.getSchema('aObject.aObjArrayObjects.data.bar'),
      );
      assert.equal(values.length, 9, 'Wrong number of values returned');
      expect(values).to.include.members([
        'eins',
        'zwei',
        'drei',
        'vier',
        'funf',
        'sechs',
        'sieben',
        'acht',
        'neun',
      ]);
    });
  });
});
