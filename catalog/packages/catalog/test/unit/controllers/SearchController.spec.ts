import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import * as sinon from 'sinon';
import { SearchController } from '../../../src/controllers/SearchController';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';

describe('SearchController - Unit', () => {
  let searchController: SearchController;
  let mockProductManager: sinon.SinonMock;
  let mockOpenSearchManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    searchController = new SearchController();
    mockProductManager = sinon.mock((searchController as any).productManager);
    mockOpenSearchManager = sinon.mock(
      (searchController as any).openSearchManager,
    );
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('searchProducts', () => {
    it('should call enforce and search', async () => {
      mockProductManager
        .expects('enforceSearchSecurityContext')
        .withExactArgs({}, { apiKey: 'apiKey' })
        .returns({});
      mockOpenSearchManager.expects('search').withExactArgs('car', {});
      await searchController.searchProducts('car', {}, { apiKey: 'apiKey' });
      mockProductManager.verify();
      mockOpenSearchManager.verify();
    });
  });
});
