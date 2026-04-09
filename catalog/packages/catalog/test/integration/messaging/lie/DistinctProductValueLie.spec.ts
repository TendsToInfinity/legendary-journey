import { _ } from '@securustablets/libraries.utils';
import { PgSandbox } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { DistinctProductValue } from '../../../../src/controllers/models/DistinctProductValue';
import { ProductDao } from '../../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { DistinctProductValueManager } from '../../../../src/lib/DistinctProductValueManager';
import { DistinctProductValueLie } from '../../../../src/messaging/lie/DistinctProductValueLie';
import { ModelFactory } from '../../../utils/ModelFactory';
import * as client from '../../../utils/client';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';
import '../../global.spec';

describe('DistinctProductValueLie - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let productDao: ProductDao;
  let productTypeDao: ProductTypeDao;
  let distinctProductValueManager: DistinctProductValueManager;
  let distinctProductValueLie: DistinctProductValueLie;

  const pgSandbox = Container.get(PgSandbox);

  before(async () => {
    productDao = Container.get(ProductDao);
    productTypeDao = Container.get(ProductTypeDao);
    distinctProductValueManager = new DistinctProductValueManager();
    distinctProductValueLie = new DistinctProductValueLie();
  });

  beforeEach(async () => {
    await pgSandbox.wipe();
  });

  afterEach(async () => {
    sinon.restore();
    await Bluebird.delay(1000);
  });

  it('DPV apply. Replacing 1 genre by Pop genre', async () => {
    const trackSchema = (await productTypeDao.findOneOrFail('track'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop'] },
      source: { genres: ['Indie Pop'] },
    });
    const { productId: productId } = await client.createProduct(product);
    const product1 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop', 'K Pop', 'Folk'] },
      source: { genres: ['Indie Pop', 'K Pop', 'Folk'] },
    });
    const { productId: product1Id } = await client.createProduct(product1);

    // initial creating DPV records
    const dpvForChange = await updateDisplayValue('Indie Pop', 'Pop');

    await distinctProductValueLie.dpvProcessHandler(dpvForChange);
    const actualProduct = await productDao.findOneOrFail({
      contains: { productId: productId },
    });
    const expectedProduct = _.merge(_.cloneDeep(actualProduct), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct).deep.equal(expectedProduct);

    const actualProduct1 = await productDao.findOneOrFail({
      contains: { productId: product1Id },
    });
    const expectedGenres = ['K Pop', 'Pop', 'Folk'];
    expect(actualProduct1.meta.genres).includes.members(expectedGenres);
  });

  it('DPV apply. Replacing 2 genres with Pop genre', async () => {
    const trackSchema = (await productTypeDao.findOneOrFail('track'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop'] },
      source: { genres: ['Indie Pop'] },
    });
    const { productId: productId } = await client.createProduct(product);
    const product1 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop', 'Rock Pop'] },
      source: { genres: ['Indie Pop', 'Rock Pop'] },
    });
    const { productId: product1Id } = await client.createProduct(product1);
    const product2 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop', 'K Pop'] },
      source: { genres: ['Indie Pop', 'K Pop'] },
    });
    const { productId: product2Id } = await client.createProduct(product2);
    const product3 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
      source: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // added an extra product
    const { productId: product3Id } = await client.createProduct(product3);

    const dpvForChange = await updateDisplayValue('Indie Pop', 'Pop');

    const dpvForChange1 = await updateDisplayValue('Rock Pop', 'Pop');

    await distinctProductValueLie.dpvProcessHandler(dpvForChange);
    await distinctProductValueLie.dpvProcessHandler(dpvForChange1);

    const actualProduct = await productDao.findOneOrFail({
      contains: { productId: productId },
    });
    const expectedProduct = _.merge(_.cloneDeep(actualProduct), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct).deep.equal(expectedProduct);

    const actualProduct1 = await productDao.findOneOrFail({
      contains: { productId: product1Id },
    });
    const expectedProduct1 = _.merge(_.cloneDeep(actualProduct1), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct1).deep.equal(expectedProduct1);

    const actualProduct2 = await productDao.findOneOrFail({
      contains: { productId: product2Id },
    });
    const expectedGenres2 = ['Pop', 'K Pop'];
    expect(actualProduct2.meta.genres).includes.members(expectedGenres2);

    const actualProduct3 = await productDao.findOneOrFail({
      contains: { productId: product3Id },
    });
    const expectedProduct3 = _.merge(_.cloneDeep(actualProduct3), {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // shouldn't be changed
    expect(actualProduct3).deep.equal(expectedProduct3);
  });

  it('DPV apply. Replacing 2 genres with different cases by Pop genre', async () => {
    const trackSchema = (await productTypeDao.findOneOrFail('track'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie pop'] },
      source: { genres: ['Indie pop'] },
    });
    const { productId: productId } = await client.createProduct(product);
    const product1 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['indie Pop', 'Rock pop'] },
      source: { genres: ['indie Pop', 'Rock pop'] },
    });
    const { productId: product1Id } = await client.createProduct(product1);
    const product2 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['InDie PoP', 'K Pop'] },
      source: { genres: ['InDie PoP', 'K Pop'] },
    });
    const { productId: product2Id } = await client.createProduct(product2);
    const product3 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
      source: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // added an extra product
    const { productId: product3Id } = await client.createProduct(product3);

    const dpvForChange = await updateDisplayValue('Indie Pop', 'Pop');

    const dpvForChange1 = await updateDisplayValue('Rock Pop', 'Pop');

    await distinctProductValueLie.dpvProcessHandler(dpvForChange);
    await distinctProductValueLie.dpvProcessHandler(dpvForChange1);

    const actualProduct = await productDao.findOneOrFail({
      contains: { productId: productId },
    });
    const expectedProduct = _.merge(_.cloneDeep(actualProduct), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct).deep.equal(expectedProduct);

    const actualProduct1 = await productDao.findOneOrFail({
      contains: { productId: product1Id },
    });
    const expectedProduct1 = _.merge(_.cloneDeep(actualProduct1), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct1).deep.equal(expectedProduct1);

    const actualProduct2 = await productDao.findOneOrFail({
      contains: { productId: product2Id },
    });
    const expectedGenres2 = ['Pop', 'K Pop'];
    expect(actualProduct2.meta.genres).includes.members(expectedGenres2);

    const actualProduct3 = await productDao.findOneOrFail({
      contains: { productId: product3Id },
    });
    const expectedProduct3 = _.merge(_.cloneDeep(actualProduct3), {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // shouldn't be changed
    expect(actualProduct3).deep.equal(expectedProduct3);
  });

  it('DPV apply. Replacing 2 genres in different cases with Pop genre in capital case', async () => {
    const trackSchema = (await productTypeDao.findOneOrFail('track'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie pop'] },
      source: { genres: ['Indie pop'] },
    });
    const { productId: productId } = await client.createProduct(product);
    const product1 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['indie Pop', 'Rock pop'] },
      source: { genres: ['indie Pop', 'Rock pop'] },
    });
    const { productId: product1Id } = await client.createProduct(product1);
    const product2 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['InDie PoP', 'K Pop'] },
      source: { genres: ['InDie PoP', 'K Pop'] },
    });
    const { productId: product2Id } = await client.createProduct(product2);
    const product3 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
      source: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // added an extra product
    const { productId: product3Id } = await client.createProduct(product3);

    const dpvForChange = await updateDisplayValue('Indie Pop', 'POP');

    const dpvForChange1 = await updateDisplayValue('Rock Pop', 'Pop');

    await distinctProductValueLie.dpvProcessHandler(dpvForChange);
    await distinctProductValueLie.dpvProcessHandler(dpvForChange1);

    const actualProduct = await productDao.findOneOrFail({
      contains: { productId: productId },
    });
    const expectedProduct = _.merge(_.cloneDeep(actualProduct), {
      meta: { genres: ['POP'] },
    });
    expect(actualProduct).deep.equal(expectedProduct);

    const actualProduct1 = await productDao.findOneOrFail({
      contains: { productId: product1Id },
    });
    const expectedProduct1 = _.merge(_.cloneDeep(actualProduct1), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct1).deep.equal(expectedProduct1);

    const actualProduct2 = await productDao.findOneOrFail({
      contains: { productId: product2Id },
    });
    const expectedGenres2 = ['POP', 'K Pop'];
    expect(actualProduct2.meta.genres).includes.members(expectedGenres2);

    const actualProduct3 = await productDao.findOneOrFail({
      contains: { productId: product3Id },
    });
    const expectedProduct3 = _.merge(_.cloneDeep(actualProduct3), {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // shouldn't be changed
    expect(actualProduct3).deep.equal(expectedProduct3);
  });

  it('DPV apply. Replacing 2 genres in different cases with Pop genre in capital case with multiple products update', async () => {
    const trackSchema = (await productTypeDao.findOneOrFail('track'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie pop'] },
      source: { genres: ['Indie pop'] },
    });
    const { productId: productId } = await client.createProduct(product);
    const productA = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie pop'] },
      source: { genres: ['Indie pop'] },
    });
    const { productId: productIdA } = await client.createProduct(productA);
    const product1 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['indie Pop', 'Rock pop'] },
      source: { genres: ['indie Pop', 'Rock pop'] },
    });
    const { productId: product1Id } = await client.createProduct(product1);
    const product2 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['InDie PoP', 'K Pop'] },
      source: { genres: ['InDie PoP', 'K Pop'] },
    });
    const { productId: product2Id } = await client.createProduct(product2);
    const product3 = ModelFactory.productFromSchema(trackSchema, {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
      source: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // added an extra product
    const { productId: product3Id } = await client.createProduct(product3);

    const dpvForChange = await updateDisplayValue('Indie Pop', 'POP');

    const dpvForChange1 = await updateDisplayValue('Rock Pop', 'Pop');

    await distinctProductValueLie.dpvProcessHandler(dpvForChange);
    await distinctProductValueLie.dpvProcessHandler(dpvForChange1);

    const actualProduct = await productDao.findOneOrFail({
      contains: { productId: productId },
    });
    const expectedProduct = _.merge(_.cloneDeep(actualProduct), {
      meta: { genres: ['POP'] },
    });
    expect(actualProduct).deep.equal(expectedProduct);

    const actualProductA = await productDao.findOneOrFail({
      contains: { productId: productIdA },
    });
    const expectedProductA = _.merge(_.cloneDeep(actualProductA), {
      meta: { genres: ['POP'] },
    });
    expect(actualProductA).deep.equal(expectedProductA);

    const actualProduct1 = await productDao.findOneOrFail({
      contains: { productId: product1Id },
    });
    const expectedProduct1 = _.merge(_.cloneDeep(actualProduct1), {
      meta: { genres: ['Pop'] },
    });
    expect(actualProduct1).deep.equal(expectedProduct1);

    const actualProduct2 = await productDao.findOneOrFail({
      contains: { productId: product2Id },
    });
    const expectedGenres2 = ['POP', 'K Pop'];
    expect(actualProduct2.meta.genres).includes.members(expectedGenres2);

    const actualProduct3 = await productDao.findOneOrFail({
      contains: { productId: product3Id },
    });
    const expectedProduct3 = _.merge(_.cloneDeep(actualProduct3), {
      meta: { genres: ['Indie Pop 1', 'K Pop 1'] },
    }); // shouldn't be changed
    expect(actualProduct3).deep.equal(expectedProduct3);
  });

  async function updateDisplayValue(
    existing: string,
    displayName: string,
  ): Promise<DistinctProductValue> {
    const dpvs = await client.fbqsDistinctProductValue({
      sourceValueName: existing.toLowerCase(),
    });
    return client.updateDistinctProductValue(
      dpvs.data[0].distinctProductValueId,
      { displayName },
    );
  }
});
