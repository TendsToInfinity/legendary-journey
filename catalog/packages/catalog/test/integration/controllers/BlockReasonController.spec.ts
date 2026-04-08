import { JwtType } from '@securustablets/libraries.httpsecurity';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as request from 'supertest';
import { BlockActionState } from '../../../src/controllers/models/BlockAction';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { BlockReasonDao } from '../../../src/data/PGCatalog/BlockReasonDao';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('BlockReasonController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let testToken: string;
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;
  let blockReasonDao: BlockReasonDao;
  let productTypeDao: ProductTypeDao;
  let movieSchema: Schema;

  before(async () => {
    testToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );
  });

  beforeEach(async () => {
    blocklistTermDao = new BlocklistTermDao();
    blockActionDao = new BlockActionDao();
    blockReasonDao = new BlockReasonDao();
    productTypeDao = new ProductTypeDao();
    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
  });

  describe('GET block reasons', () => {
    it('should return a list of blocklist reasons', async () => {
      let blocklistTerm = ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [+blocklistTerm.blocklistTermId],
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      const { productId } = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      let blockReason = ModelFactory.blockReason({
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
        term: blocklistTerm.term,
        productId,
      });

      blockReason = await blockReasonDao.createAndRetrieve(
        blockReason,
        ModelFactory.auditContext(),
      );

      const res = await request(app)
        .get('/blockReasons')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).to.equal(200);

      const blockReasons = res.body.data;
      expect(blockReasons.length).to.equal(1);
      expect(blockReasons[0].blockReasonId).to.equal(blockReason.blockReasonId);
      expect(blockReasons[0].blockActionId).to.equal(blockAction.blockActionId);
      expect(blockReasons[0].termId).to.deep.equal(
        blocklistTerm.blocklistTermId,
      );
    });
  });

  describe('GET block reason by id', () => {
    it('should return a blocklist reason', async () => {
      let blocklistTerm = ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [+blocklistTerm.blocklistTermId],
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      const { productId } = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      let blockReason = ModelFactory.blockReason({
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
        term: blocklistTerm.term,
        productId,
      });
      delete blockReason.productId;

      blockReason = await blockReasonDao.createAndRetrieve(
        blockReason,
        ModelFactory.auditContext(),
      );

      const res = await request(app)
        .get(`/blockReasons/${blockReason.blockReasonId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const data = res.body;
      expect(data.blockReasonId).to.equal(blockReason.blockReasonId);
      expect(data.blockActionId).to.equal(blockAction.blockActionId);
      expect(data.termId).to.deep.equal(blocklistTerm.blocklistTermId);
    });
  });
});
