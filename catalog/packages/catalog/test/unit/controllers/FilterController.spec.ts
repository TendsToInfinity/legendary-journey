import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { FilterController } from '../../../src/controllers/FilterController';

describe('FilterController - Unit', () => {
  let controller: FilterController;
  let mockCatalogManager: sinon.SinonMock;

  beforeEach(() => {
    controller = new FilterController();
    mockCatalogManager = sinon.mock((controller as any).catalogManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getPackagesByFilter', () => {
    it('should return packages', async () => {
      const expectedResult = [
        {
          name: 'test',
          id: '1',
          price: 9.99,
          description: 'a test',
          applications: [],
        },
        {
          name: 'test2',
          id: '2',
          price: 19.99,
          description: 'another test',
          applications: [],
        },
      ];
      mockCatalogManager
        .expects('findPackages')
        .withExactArgs(sinon.match.object)
        .resolves(expectedResult);

      const result = await controller.getPackagesByFilter({
        customerId: 'I-003320',
      });

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
    it('should return packages when using all the filters', async () => {
      const expectedResult = [
        {
          name: 'test',
          id: '1',
          price: 9.99,
          description: 'a test',
          applications: [],
        },
        {
          name: 'test2',
          id: '2',
          price: 19.99,
          description: 'another test',
          applications: [],
        },
      ];
      mockCatalogManager.expects('convertSType').withExactArgs('st');
      mockCatalogManager
        .expects('findPackages')
        .withExactArgs(sinon.match.object)
        .resolves(expectedResult);

      const result = await controller.getPackagesByFilter({
        customerId: 'I-003320',
        siteId: '09876',
        channel: 'MakeMine',
        stype: 'st',
      });

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
    it('should throw an exception if no customerId is provided', async () => {
      try {
        await controller.getPackagesByFilter({ stype: 'st' } as any);
        expect.fail();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.InvalidData.name);
        expect(ex.errors).to.deep.equal([
          'Invalid Filter! Filter must contain a customerId',
        ]);
      }
    });
  });
});
