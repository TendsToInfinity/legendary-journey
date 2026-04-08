import { expect } from 'chai';
import { SearchHelper } from '../../../src/controllers/SearchHelper';

describe('SearchHelper', () => {
  const searchHelper = new SearchHelper();

  function defaultFindOpts() {
    return {
      pageNumber: 0,
      pageSize: 25,
      total: false,
      orderBy: undefined,
    };
  }

  describe('buildPaginationOptions', () => {
    it('should parse strings into the correct data types', () => {
      expect(
        searchHelper.buildPaginationOptions({
          pageNumber: '12',
          pageSize: '100',
          total: 'true',
          orderBy: 'cdate:DESC',
        }),
      ).to.deep.equal({
        pageNumber: 12,
        pageSize: 100,
        total: true,
        orderBy: { cdate: 'DESC' },
      });
    });
    it('should provide default values', () => {
      expect(searchHelper.buildPaginationOptions({})).to.deep.equal(
        defaultFindOpts(),
      );
    });
    it('should build orderBy ASC', () => {
      expect(
        searchHelper.buildPaginationOptions({ orderBy: 'someField:ASC' }),
      ).to.deep.equal({
        ...defaultFindOpts(),
        orderBy: { someField: 'ASC' },
      });
    });
    it('should build orderBy DESC', () => {
      expect(
        searchHelper.buildPaginationOptions({ orderBy: 'someField:DESC' }),
      ).to.deep.equal({
        ...defaultFindOpts(),
        orderBy: { someField: 'DESC' },
      });
    });
    it('should build orderBy empty string', () => {
      expect(
        searchHelper.buildPaginationOptions({ orderBy: '' }),
      ).to.deep.equal(defaultFindOpts());
      expect(
        searchHelper.buildPaginationOptions({ orderBy: null }),
      ).to.deep.equal(defaultFindOpts());
      expect(
        searchHelper.buildPaginationOptions({ orderBy: undefined }),
      ).to.deep.equal(defaultFindOpts());
    });
  });
  describe('buildResponse', () => {
    it('should build response with [model[], number] and with total', () => {
      const data = ['my datas'] as any;

      expect(
        searchHelper.buildResponse([data, 2000], {
          pageNumber: 10,
          pageSize: 50,
          total: true,
        }),
      ).to.deep.equal({
        data,
        pageNumber: 10,
        pageSize: 50,
        total: 2000,
      });
    });
    it('should build response with [model[], number] and without total', () => {
      const data = ['my datas'] as any;

      expect(
        searchHelper.buildResponse([data, 2000], {
          pageNumber: 10,
          pageSize: 50,
          total: false,
        }),
      ).to.deep.equal({
        data,
        pageNumber: 10,
        pageSize: 50,
        total: undefined,
      });
    });
    it('should build response with model[] and with total', () => {
      const data = ['my data 1', 'my data 2'] as any;

      expect(
        searchHelper.buildResponse(data, {
          pageNumber: 10,
          pageSize: 50,
          total: true,
        }),
      ).to.deep.equal({
        data,
        pageNumber: 10,
        pageSize: 50,
        total: 2,
      });
    });
    it('should build response with model[] and without total', () => {
      const data = ['my data 1', 'my data 2'] as any;

      expect(
        searchHelper.buildResponse(data, {
          pageNumber: 10,
          pageSize: 50,
          total: false,
        }),
      ).to.deep.equal({
        data,
        pageNumber: 10,
        pageSize: 50,
        total: undefined,
      });
    });
  });
});
