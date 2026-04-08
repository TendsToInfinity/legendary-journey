import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CatalogService } from '../../../../src/CatalogService';
import { BlocklistTermDao } from '../../../../src/data/PGCatalog/BlocklistTermDao';
import { LargeImpactEventDao } from '../../../../src/data/PGCatalog/LargeImpactEventDao';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { ProductManager } from '../../../../src/lib/ProductManager';
import { ProductUpsertRequestHandler } from '../../../../src/messaging/handlers/ProductUpsertRequestHandler';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';

describe('ProductUpsertRequestHandler - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true, cache: true });
  let productMan: ProductManager;
  let productTypeDao: ProductTypeDao;
  let productUpsertRequestHandler: ProductUpsertRequestHandler;
  let blocklistTermDao: BlocklistTermDao;
  let lieDao: LargeImpactEventDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(async () => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    productMan = new ProductManager();
    productTypeDao = new ProductTypeDao();
    productUpsertRequestHandler = new ProductUpsertRequestHandler();
    blocklistTermDao = new BlocklistTermDao();
    lieDao = new LargeImpactEventDao();
  });

  afterEach(() => {
    sinon.restore();
  });

  // use os to search by name
  const findByName = async (name: string, productTypeId: string) => {
    const result = await productMan.search({
      query: {
        clauses: {
          'meta.name': [name],
        },
        productTypeId,
      },
    });

    return result.data.find((prod) => prod.meta.name === name);
  };
  describe('handleMessage', () => {
    it('should create new product', async () => {
      const routingKey = 'test';
      const gameType = await productTypeDao.findOneOrFail('game');
      const fakedGame = ModelFactory.productFromSchema(gameType.jsonSchema, {
        meta: { name: 'josh' },
      });

      await productUpsertRequestHandler.handleMessage(routingKey, {
        product: fakedGame,
      });

      const game = await findByName(fakedGame.meta.name, 'game');

      expect(game).to.be.not.null;
      expect(game.productId).to.be.not.null;
      expect(game.productTypeId).to.equal(fakedGame.productTypeId);
    });

    it('should create new artist product', async () => {
      const routingKey = 'test';
      const artistType = await productTypeDao.findOneOrFail('artist');
      const fakedArtist = ModelFactory.productFromSchema(
        artistType.jsonSchema,
        { meta: { name: 'josh' } },
      );
      await productUpsertRequestHandler.handleMessage(routingKey, {
        product: fakedArtist,
      });

      const artist = await findByName(fakedArtist.meta.name, 'artist');

      expect(artist).to.be.not.null;
      expect(artist.productId).to.be.not.null;
      expect(artist.productTypeId).to.equal(fakedArtist.productTypeId);
    });

    it('should create update existing product', async () => {
      const routingKey = 'test';
      const gameType = await productTypeDao.findOneOrFail('game');
      const product = ModelFactory.productFromSchema(gameType.jsonSchema, {
        meta: { name: 'bob' },
      });
      product.productId = await productMan.createProduct(product, {
        apiKey: 'test',
      });
      product.meta.name = 'steve';

      await productUpsertRequestHandler.handleMessage(routingKey, { product });

      const updatedProduct = await productMan.findOneOrFail(product.productId);

      expect(updatedProduct.meta.name).to.equal(product.meta.name);
      expect(updatedProduct.productTypeId).to.equal(product.productTypeId);
      expect(updatedProduct.productId).to.equal(product.productId);
    });

    it('should create update existing artist product', async () => {
      const routingKey = 'test';
      const artistType = await productTypeDao.findOneOrFail('artist');
      const product = ModelFactory.productFromSchema(artistType.jsonSchema, {
        meta: { name: 'bob' },
      });

      const productId = await productMan.createProduct(product, {
        apiKey: 'test',
      });
      product.productId = productId;
      product.meta.name = 'dave';

      await productUpsertRequestHandler.handleMessage(routingKey, { product });

      const updateProduct = await productMan.findOneOrFail(product.productId);

      expect(updateProduct.meta.name).to.equal(product.meta.name);
      expect(updateProduct.productTypeId).to.equal(product.productTypeId);
      expect(updateProduct.productId).to.equal(product.productId);
    });
  });

  /**
   * auto review tests
   * 1. Create an Album and check that album is blocked by term
   * 2. Create a song and check that song is blocked by the parent
   * 3. Create an Artist that matches terms and check that LIE is created for it
   */
  describe('auto-block handleMessage', () => {
    it('should create a product and block the product and it child product', async () => {
      const term = ModelFactory.blocklistTerm({
        term: 'badBlockedTerm',
        productTypeGroupId: 'music',
      });
      await blocklistTermDao.createAndRetrieve(
        term,
        ModelFactory.auditContext(),
      );

      const routingKey = 'test';
      const albumType = await productTypeDao.findOneOrFail('album');
      const trackType = await productTypeDao.findOneOrFail('track');
      const album = ModelFactory.productFromSchema(albumType.jsonSchema, {
        meta: { name: 'badBlockedTerm' },
        productId: undefined,
      });

      await productUpsertRequestHandler.handleMessage(routingKey, {
        product: album,
      });
      const blockedAlbum = await findByName('badBlockedTerm', 'album');

      const childTrack = ModelFactory.productFromSchema(trackType.jsonSchema, {
        meta: { name: 'Non Blocking name' },
        source: {
          parentProductId: blockedAlbum.productId,
          vendorParentProductId: blockedAlbum.source.vendorProductId,
          vendorName: blockedAlbum.source.vendorName,
        },
        productId: undefined,
      });
      await productUpsertRequestHandler.handleMessage(routingKey, {
        product: childTrack,
      });
      const blockedChild = await findByName('Non Blocking name', 'track');

      expect(blockedAlbum.isBlocked).to.be.true;
      expect(blockedChild.isBlocked).to.be.true;
    });
    it('should block artist product inline and create LIE for asunc update', async () => {
      const termDoc = ModelFactory.blocklistTerm({
        term: 'badBlockedTermAlbum',
        productTypeGroupId: 'music',
      });
      const term = await blocklistTermDao.createAndRetrieve(
        termDoc,
        ModelFactory.auditContext(),
      );

      const routingKey = 'test';
      const artistType = await productTypeDao.findOneOrFail('artist');
      const artist = ModelFactory.productFromSchema(artistType.jsonSchema, {
        meta: { name: 'badBlockedTermAlbum' },
        productId: undefined,
      });

      await productUpsertRequestHandler.handleMessage(routingKey, {
        product: artist,
      });
      const blockedArtist = await findByName('badBlockedTermAlbum', 'artist');

      // check that LIE is created
      const lieCreated = await lieDao.find({
        by: { routingKey: 'block_action.pending' },
      });

      expect(blockedArtist.isBlocked).to.be.true;
      expect(lieCreated.length).to.be.equal(1);
      expect(lieCreated[0].payload.blocklistTermIds[0]).to.be.equal(
        term.blocklistTermId,
      );
    });
  });
});
