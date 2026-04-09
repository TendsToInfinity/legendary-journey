import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert, expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { HomepageController } from '../../../src/controllers/HomepageController';
import { Homepage } from '../../../src/controllers/models/Homepage';
import { Product } from '../../../src/controllers/models/Product';
import { Search } from '../../../src/controllers/models/Search';
import { Paginated } from '../../../src/lib/models/Paginated';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('HomepageController - Unit', () => {
  let controller: HomepageController;
  let mockDao: sinon.SinonMock;
  let mockProductMan: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = Container.get(HomepageController);
    mockDao = sinon.mock((controller as any).homepageDao);
    mockProductMan = sinon.mock((controller as any).productMan);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findHomepage', () => {
    it('should call HomepageDao.findOneOrFail', async () => {
      mockDao.expects('findOneOrFail').withArgs(1);
      await controller.findHomepage('1');
      mockDao.verify();
    });
  });

  describe('findHomepageProducts', () => {
    it('should find products for a homepage', async () => {
      const search = { 'meta.rating': ['G'] };
      const securityContext = {};
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };

      mockDao.expects('findOneOrFail').withArgs(1).returns({ search });
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(search);
      mockProductMan
        .expects('search')
        .withArgs(search)
        .returns(expectedResults);

      const results = await controller.findHomepageProducts(
        { query: {} } as Request,
        '1',
        securityContext,
      );

      expect(results).to.equal(expectedResults);

      mockDao.verify();
      mockProductMan.verify();
    });
    // This test is disabled because I cannot figure out how to mock/inject a custom "ttlShort" for testing purposes.
    xit('should use cache for same request', async () => {
      const search = { 'meta.rating': ['G'] };
      const securityContext = {};
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };

      mockDao.expects('findOneOrFail').withArgs(1).returns({ search });
      mockDao.expects('findOneOrFail').withArgs(1).returns({ search });
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(search);
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(search);
      mockProductMan
        .expects('cacheableSearch')
        .withArgs(search)
        .returns(expectedResults);

      const results = await controller.findHomepageProducts(
        { query: {} } as Request,
        '1',
        securityContext,
      );

      expect(results).to.equal(expectedResults);
      await controller.findHomepageProducts(
        { query: {} } as Request,
        '1',
        securityContext,
      );

      mockDao.verify();
      mockProductMan.verify();
    });
  });

  describe('findHomepageByProductType', () => {
    it('should call HomepageDao.find', async () => {
      mockDao.expects('find').withArgs({
        by: { productTypeId: 'movie' },
        orderBy: [{ rank: 'ASC' }, { displayName: 'ASC' }],
      });
      await controller.findHomepagesByProductType('movie');
      mockDao.verify();
    });
  });

  describe('createHomepage', () => {
    it('should call HomepageDao.create', async () => {
      const homepage = {
        displayName: 'Test Display Name',
        productTypeId: 'movie',
        rank: 0,
        search: {} as Search,
      };
      const corpJwt = SecurityFactory.corpJwt();
      const newHomepageId = 1;

      mockDao
        .expects('create')
        .withArgs(homepage, { corpJwt })
        .resolves(newHomepageId);
      const result = await controller.createHomepage(homepage as Homepage, {
        corpJwt,
      });

      expect(result.homepageId).to.equal(newHomepageId);

      sinon.verify();
    });
  });

  describe('updateHomepage', () => {
    const homepage = {
      homepageId: 1,
      version: 0,
      displayName: 'Test Display Name',
      productTypeId: 'movie',
      rank: 0,
      search: {} as Search,
    };
    const corpJwt = SecurityFactory.corpJwt();

    it('should call HomepageDao.update', async () => {
      mockDao
        .expects('update')
        .withArgs(homepage.homepageId, homepage, { corpJwt });
      await controller.updateHomepage(
        homepage.homepageId.toString(),
        homepage as Homepage,
        { corpJwt },
      );

      sinon.verify();
    });

    it('should get a 400 for mismatched homepageIds', async () => {
      try {
        await controller.updateHomepage('123', homepage, { corpJwt });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }

      mockDao.verify();
    });
  });

  describe('deleteHomepage', () => {
    it('should call HomepageDao.delete', async () => {
      const corpJwt = SecurityFactory.corpJwt();

      mockDao.expects('delete').withArgs(1, { corpJwt });
      await controller.deleteHomepage('1', { corpJwt });
      mockDao.verify();
    });
  });
});
