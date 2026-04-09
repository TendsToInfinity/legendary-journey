import { expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { BlockReasonController } from '../../../src/controllers/BlockReasonController';
import { BlockReason } from '../../../src/controllers/models/BlockReason';
import { Paginated } from '../../../src/lib/models/Paginated';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlockReasonController - Unit', () => {
  let controller: BlockReasonController;
  let mockReasonMan: sinon.SinonMock;
  const securityContext = {};

  beforeEach(() => {
    controller = new BlockReasonController();
    mockReasonMan = sinon.mock((controller as any).blocklistReasonManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getBlockReasons', () => {
    it('should return blocklist reasons', async () => {
      const blockReasons = [
        ModelFactory.blockReason(),
        ModelFactory.blockReason(),
      ];
      const paginatedResult: Paginated<BlockReason> = {
        data: blockReasons,
        total: 2,
        pageNumber: 0,
        pageSize: 1,
      };
      mockReasonMan
        .expects('getBlockReasons')
        .withExactArgs(sinon.match.object)
        .resolves(paginatedResult);
      const result = await controller.getBlockReasons({ query: {} } as Request);
      expect(result.data).to.deep.equal(blockReasons);
      expect(result.total).to.deep.equal(blockReasons.length);
      mockReasonMan.verify();
    });

    it('should handle error while getting block list reasons', async () => {
      mockReasonMan
        .expects('getBlockReasons')
        .withExactArgs(sinon.match.object)
        .rejects(new Error('test'));
      try {
        await controller.getBlockReasons({ query: {} } as Request);
      } catch (err) {
        expect(err.message).to.equal('test');
      }
      mockReasonMan.verify();
    });
  });

  describe('getBlockReason', () => {
    it('should return blocklist reason', async () => {
      const expectedResult = ModelFactory.blockReason({ blockReasonId: 1 });
      mockReasonMan
        .expects('getBlockReason')
        .withExactArgs(1)
        .resolves(expectedResult);
      const result = await controller.getBlockReason(1, securityContext);
      expect(result).to.deep.equal(expectedResult);
      expect(result.blockReasonId).to.equal(expectedResult.blockReasonId);
      mockReasonMan.verify();
    });

    it('should throw exception if blocklist reason not found', async () => {
      mockReasonMan
        .expects('getBlockReason')
        .withExactArgs(1)
        .rejects(new Error('Not found'));
      try {
        await controller.getBlockReason(1, securityContext);
      } catch (e) {
        expect(e.message).to.equal('Not found');
      }
      mockReasonMan.verify();
    });
  });
});
