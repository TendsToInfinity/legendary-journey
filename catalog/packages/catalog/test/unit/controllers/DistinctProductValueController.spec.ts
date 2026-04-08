import { expect } from 'chai';
import { Request } from 'express';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { DistinctProductValueController } from '../../../src/controllers/DistinctProductValueController';
import { DistinctProductValue } from '../../../src/controllers/models/DistinctProductValue';
import { Paginated } from '../../../src/lib/models/Paginated';
import { ModelFactory } from '../../utils/ModelFactory';

describe('DistinctProductValueController - Unit', () => {
  let controller: DistinctProductValueController;
  let mockDistinctProductValueManager: sinon.SinonMock;
  const securityContext = {};

  beforeEach(() => {
    controller = new DistinctProductValueController();
    mockDistinctProductValueManager = sinon.mock(
      (controller as any).distinctProductValueManager,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getDistinctProductValues', () => {
    it('should return distinct product values', async () => {
      const distinctProductValues = [
        ModelFactory.distinctProductValue(),
        ModelFactory.distinctProductValue(),
      ];
      const paginatedResult: Paginated<DistinctProductValue> = {
        data: distinctProductValues,
        pageNumber: 0,
        pageSize: 25,
      };
      mockDistinctProductValueManager
        .expects('findByQueryString')
        .withExactArgs({})
        .resolves(paginatedResult);
      const result = await controller.getDistinctProductValues({
        query: {},
      } as Request);
      expect(result).to.deep.equal(paginatedResult);
      expect(result.data).to.deep.equal(distinctProductValues);
      mockDistinctProductValueManager.verify();
    });
  });

  describe('getDistinctProductValueById', () => {
    it('should return distinct product value', async () => {
      const distinctProductValueId = 1;
      const expectedResult = ModelFactory.distinctProductValue({
        distinctProductValueId,
      });
      mockDistinctProductValueManager
        .expects('findOneOrFail')
        .withExactArgs(1)
        .resolves(expectedResult);
      const result = await controller.getDistinctProductValueById(1);
      expect(result).to.deep.equal(expectedResult);
      expect(result.distinctProductValueId).to.equal(distinctProductValueId);
      mockDistinctProductValueManager.verify();
    });
  });

  describe('updateDistinctProductValueById', () => {
    it('should update distinct product value', async () => {
      const distinctProductValueId = 1;
      const expectedResult = ModelFactory.distinctProductValue({
        distinctProductValueId,
      });
      mockDistinctProductValueManager
        .expects('updateBulk')
        .withExactArgs([1], expectedResult, securityContext)
        .resolves([expectedResult]);
      const result = await controller.updateDistinctProductValueById(
        1,
        securityContext,
        expectedResult,
      );
      expect(result).to.deep.equal(expectedResult);
      expect(result.distinctProductValueId).to.equal(distinctProductValueId);
      mockDistinctProductValueManager.verify();
    });
  });

  describe('bulkUpdateDistinctProductValues', () => {
    it('should update distinct product values', async () => {
      const distinctProductValuesArray = [
        ModelFactory.distinctProductValue({
          distinctProductValueId: 1,
          displayName: faker.random.word(),
        }),
        ModelFactory.distinctProductValue({
          distinctProductValueId: 2,
          displayName: faker.random.word(),
        }),
      ];
      const requestBody = {
        data: { displayName: faker.random.word() },
        ids: [1, 2],
      };
      const updatedDPVs = distinctProductValuesArray.map((dpv) => {
        return { ...dpv, ...requestBody.data };
      });
      mockDistinctProductValueManager
        .expects('updateBulk')
        .withExactArgs(requestBody.ids, requestBody.data, securityContext)
        .resolves(updatedDPVs);
      const result = await controller.bulkUpdateDistinctProductValues(
        securityContext,
        requestBody,
      );
      expect(result).to.deep.equal({ data: updatedDPVs });
      mockDistinctProductValueManager.verify();
    });
  });
});
