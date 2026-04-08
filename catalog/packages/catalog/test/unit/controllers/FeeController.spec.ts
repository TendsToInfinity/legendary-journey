import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert, expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { FeeController } from '../../../src/controllers/FeeController';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FeeController - Unit', () => {
  let controller: FeeController;
  let mockDao: sinon.SinonMock;

  beforeEach(() => {
    controller = new FeeController();
    mockDao = sinon.mock((controller as any).feeDao);
  });

  afterEach(() => {
    mockDao.restore();
  });

  describe('findFees', () => {
    it('should provide defaults and call FeeDao.find', async () => {
      mockDao.expects('findByQueryString').withArgs({});
      await controller.findFees({ query: {} } as Request);
      mockDao.verify();
    });
  });

  describe('findFee', () => {
    it('should call FeeDao.findOneOrFail', async () => {
      mockDao.expects('findOneOrFail').withArgs(1);
      await controller.findFee('1');
      mockDao.verify();
    });
  });

  describe('createFee', () => {
    it('should call FeeDao.create', async () => {
      const fee = ModelFactory.fee();
      const corpJwt = SecurityFactory.corpJwt();
      const newFeeId = 1;

      mockDao.expects('create').withArgs(fee, { corpJwt }).resolves(newFeeId);
      const result = await controller.createFee(fee, { corpJwt });

      expect(result.feeId).to.equal(newFeeId);

      mockDao.verify();
    });
  });

  describe('updateFee', () => {
    const fee = { ...ModelFactory.fee(), feeId: 1 };
    const corpJwt = SecurityFactory.corpJwt();

    it('should call FeeDao.update', async () => {
      mockDao.expects('update').withArgs(fee.feeId, fee, { corpJwt });
      await controller.updateFee(fee.feeId.toString(), fee, { corpJwt });

      mockDao.verify();
    });

    it('should get a 400 for mismatched feeIds', async () => {
      try {
        await controller.updateFee('123', fee, { corpJwt });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }

      mockDao.verify();
    });
  });

  describe('deleteFee', () => {
    it('should call FeeDao.delete', async () => {
      const corpJwt = SecurityFactory.corpJwt();

      mockDao.expects('delete').withArgs(1, { corpJwt });
      await controller.deleteFee('1', { corpJwt });
      mockDao.verify();
    });
  });
});
