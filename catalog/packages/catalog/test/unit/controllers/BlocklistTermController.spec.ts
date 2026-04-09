import { expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { BlocklistTermController } from '../../../src/controllers/BlocklistTermController';
import { BlocklistTerm } from '../../../src/controllers/models/BlocklistTerm';
import { Paginated } from '../../../src/lib/models/Paginated';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlocklistTermController - Unit', () => {
  let controller: BlocklistTermController;
  let mockBlocklistMan: sinon.SinonMock;
  const securityContext = {};

  beforeEach(() => {
    controller = new BlocklistTermController();
    mockBlocklistMan = sinon.mock((controller as any).blocklistMan);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findBlocklistTerms', () => {
    it('should return blocklist terms', async () => {
      const blocklistTerms = [
        ModelFactory.blocklistTerm({ blocklistTermId: 1 }),
        ModelFactory.blocklistTerm({ blocklistTermId: 2 }),
      ];
      const paginatedResult: Paginated<BlocklistTerm> = {
        data: blocklistTerms,
        pageNumber: 0,
        pageSize: 25,
      };
      mockBlocklistMan
        .expects('getBlocklistTerms')
        .withExactArgs(sinon.match.object)
        .resolves(paginatedResult);
      const result = await controller.findBlocklistTerms({
        query: {},
      } as any as Request);
      expect(result).to.deep.equal(paginatedResult);
      expect(result.data).to.deep.equal(blocklistTerms);
      mockBlocklistMan.verify();
    });

    it('should return blocklist terms with pagination', async () => {
      const blocklistTerms = [
        ModelFactory.blocklistTerm({ blocklistTermId: 2 }),
      ];
      const paginatedResult: Paginated<BlocklistTerm> = {
        data: blocklistTerms,
        pageNumber: 1,
        pageSize: 1,
      };
      mockBlocklistMan
        .expects('getBlocklistTerms')
        .withExactArgs(sinon.match.object)
        .resolves(paginatedResult);
      const result = await controller.findBlocklistTerms({
        query: { pageNumber: 1, pageSize: 2, total: true },
      } as any as Request);
      expect(result).to.deep.equal(paginatedResult);
      expect(result.data).to.deep.equal(blocklistTerms);
      mockBlocklistMan.verify();
    });

    it('should return blocklist terms with total', async () => {
      const blocklistTerms = [
        ModelFactory.blocklistTerm({ blocklistTermId: 1 }),
        ModelFactory.blocklistTerm({ blocklistTermId: 2 }),
      ];
      const paginatedResult: Paginated<BlocklistTerm> = {
        data: blocklistTerms,
        total: 2,
        pageNumber: 0,
        pageSize: 1,
      };
      mockBlocklistMan
        .expects('getBlocklistTerms')
        .withExactArgs(sinon.match.object)
        .resolves(paginatedResult);
      const result = await controller.findBlocklistTerms({
        query: { total: true },
      } as any as Request);
      expect(result).to.deep.equal(paginatedResult);
      expect(result.data).to.deep.equal(blocklistTerms);
      expect(result.total).to.equal(2);
      mockBlocklistMan.verify();
    });

    it('should return blocklist terms with orderBy', async () => {
      const blocklistTerms = [
        ModelFactory.blocklistTerm({ blocklistTermId: 1 }),
        ModelFactory.blocklistTerm({ blocklistTermId: 2 }),
      ];
      const paginatedResult: Paginated<BlocklistTerm> = {
        data: blocklistTerms,
        total: 2,
        pageNumber: 0,
        pageSize: 1,
      };
      mockBlocklistMan
        .expects('getBlocklistTerms')
        .withExactArgs(sinon.match.object)
        .resolves(paginatedResult);
      const result = await controller.findBlocklistTerms({
        query: { orderBy: 'blocklistTermId' },
      } as any as Request);
      expect(result).to.deep.equal(paginatedResult);
      expect(result.data).to.deep.equal(blocklistTerms);
      expect(result.total).to.equal(2);
      mockBlocklistMan.verify();
    });

    it('should handle error if no data', async () => {
      mockBlocklistMan
        .expects('getBlocklistTerms')
        .withExactArgs(sinon.match.object)
        .rejects(new Error('404'));
      try {
        await controller.findBlocklistTerms({ query: {} } as any as Request);
      } catch (e) {
        expect(e.message).to.equal('404');
      }
      mockBlocklistMan.verify();
    });
  });

  describe('findBlocklistTermById', () => {
    it('should return blocklist term', async () => {
      const expectedResult = ModelFactory.blocklistTerm();
      mockBlocklistMan
        .expects('getBlocklistTerm')
        .withExactArgs(1)
        .resolves(expectedResult);
      const result = await controller.findBlocklistTermById(1);
      expect(result).to.deep.equal(expectedResult);
      expect(result.blocklistTermId).to.equal(expectedResult.blocklistTermId);
      mockBlocklistMan.verify();
    });

    it('should handle error if no data', async () => {
      mockBlocklistMan
        .expects('getBlocklistTerm')
        .withExactArgs(1)
        .rejects(new Error('404'));
      try {
        await controller.findBlocklistTermById(1);
      } catch (e) {
        expect(e.message).to.equal('404');
      }
      mockBlocklistMan.verify();
    });

    it('should handle error if no id', async () => {
      mockBlocklistMan
        .expects('getBlocklistTerm')
        .withExactArgs(1)
        .rejects(new Error('404'));
      try {
        await controller.findBlocklistTermById(1);
      } catch (e) {
        expect(e.message).to.equal('404');
      }
      mockBlocklistMan.verify();
    });
  });

  describe('createBlocklistTerm', () => {
    it('should create blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const expectedResult = [
        ModelFactory.blocklistTerm({ term: 'test', productTypeGroupId }),
      ];
      mockBlocklistMan
        .expects('createOrUpdateBlocklistTerms')
        .withExactArgs(['test'], productTypeGroupId, securityContext)
        .resolves(expectedResult);
      const result = await controller.createBlocklistTerm(
        { terms: ['test'], productTypeGroupId },
        securityContext,
      );
      expect(result.data).to.deep.equal(expectedResult);
      mockBlocklistMan.verify();
    });

    it('should handle error if unprocessable data', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      mockBlocklistMan
        .expects('createOrUpdateBlocklistTerms')
        .withExactArgs(['test'], productTypeGroupId, securityContext)
        .rejects(new Error('422'));
      try {
        await controller.createBlocklistTerm(
          { terms: ['test'], productTypeGroupId },
          securityContext,
        );
      } catch (e) {
        expect(e.message).to.equal('422');
      }
      mockBlocklistMan.verify();
    });
  });

  describe('disableBlocklistTerms', () => {
    it('should disable blocklist term', async () => {
      mockBlocklistMan
        .expects('disableBlocklistTerms')
        .withExactArgs([1], securityContext)
        .resolves();
      await controller.disableBlocklistTerms({ ids: [1] }, securityContext);
      mockBlocklistMan.verify();
    });

    it('should handle error if no id', async () => {
      mockBlocklistMan
        .expects('disableBlocklistTerms')
        .withExactArgs([1], securityContext)
        .rejects(new Error('404'));
      try {
        await controller.disableBlocklistTerms({ ids: [1] }, securityContext);
      } catch (e) {
        expect(e.message).to.equal('404');
      }
      mockBlocklistMan.verify();
    });
  });
});
