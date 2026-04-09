import { expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { BlockActionController } from '../../../src/controllers/BlockActionController';
import { BlockAction } from '../../../src/controllers/models/BlockAction';
import { Paginated } from '../../../src/lib/models/Paginated';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlockActionController - Unit', () => {
  let controller: BlockActionController;
  let mockBlocklistMan: sinon.SinonMock;
  const securityContext = {};

  beforeEach(() => {
    controller = new BlockActionController();
    mockBlocklistMan = sinon.mock((controller as any).blocklistMan);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getBlockActions', () => {
    it('should return blocklist actions', async () => {
      const blockActions = [
        ModelFactory.blockAction(),
        ModelFactory.blockAction(),
      ];
      const paginatedResult: Paginated<BlockAction> = {
        data: blockActions,
        pageNumber: 0,
        pageSize: 25,
      };
      mockBlocklistMan
        .expects('getBlockActions')
        .withExactArgs(sinon.match.object)
        .resolves(paginatedResult);
      const result = await controller.getBlockActions({ query: {} } as Request);
      expect(result).to.deep.equal(paginatedResult);
      expect(result.data).to.deep.equal(blockActions);
      mockBlocklistMan.verify();
    });

    it('should handle error while getting block list actions', async () => {
      mockBlocklistMan
        .expects('getBlockActions')
        .withExactArgs(sinon.match.object)
        .rejects(new Error('test'));
      try {
        await controller.getBlockActions({ query: {} } as Request);
      } catch (err) {
        expect(err.message).to.equal('test');
      }
      mockBlocklistMan.verify();
    });
  });

  describe('getBlockAction', () => {
    it('should return blocklist action', async () => {
      const expectedResult = ModelFactory.blockAction({ blockActionId: 1 });
      mockBlocklistMan
        .expects('getBlockAction')
        .withExactArgs(1)
        .resolves(expectedResult);
      const result = await controller.getBlockAction(1, securityContext);
      expect(result).to.deep.equal(expectedResult);
      expect(result.blockActionId).to.deep.equal(1);
      mockBlocklistMan.verify();
    });

    it('should throw exception if blocklist action not found', async () => {
      mockBlocklistMan
        .expects('getBlockAction')
        .withExactArgs(1)
        .rejects(new Error('Not found'));
      try {
        await controller.getBlockAction(1, securityContext);
      } catch (e) {
        expect(e.message).to.equal('Not found');
      }
      mockBlocklistMan.verify();
    });
  });
});
