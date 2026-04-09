import { expect } from 'chai';
import { ProductStatus } from '../../../src/controllers/models/Product';
import { Search } from '../../../src/controllers/models/Search';
import { OpenSearchConverter } from '../../../src/data/OpenSearchConverter';
import { ModelFactory } from '../../utils/ModelFactory';

describe('OpenSearchConverter - Unit', () => {
  let openSearchConverter: OpenSearchConverter;

  beforeEach(() => {
    openSearchConverter = new OpenSearchConverter();
  });

  describe('convertRulesSearchToQuery', () => {
    it('should return expected SearchResult when supplied with a rules search', () => {
      const inputSearch = {
        query: {
          productTypeId: 'movie',
          clauses: {
            'digest.ruleIds': [1, 2, 3, 4],
            productId: [1, 2],
            'source.vendorProductId': ['vendorId'],
          },
        },
        pageSize: 10000,
        total: true,
      };

      const expectedSearchRequest = {
        from: 0,
        query: {
          bool: {
            filter: [
              { term: { 'status.keyword': ProductStatus.Active } },
              { term: { isBlocked: false } },
            ],
            should: [
              { terms: { 'digest.ruleIds': [1, 2, 3, 4] } },
              { terms: { _id: [1, 2] } },
              { terms: { 'source.vendorProductId.keyword': ['vendorId'] } },
            ],
            minimum_should_match: 1,
          },
        },
        size: 10000,
        track_total_hits: true,
      };
      const query = openSearchConverter.convertRulesSearchToQuery(inputSearch);
      expect(query).to.deep.equal(expectedSearchRequest);
    });
    it('should return expected SearchResult when supplied with a rules search, empty clause', () => {
      const inputSearch = {
        query: {
          productTypeId: 'movie',
          clauses: {},
        },
        pageSize: 10000,
        total: true,
      };

      const expectedSearchRequest = {
        from: 0,
        query: {
          bool: {
            filter: [
              { term: { 'status.keyword': ProductStatus.Active } },
              { term: { isBlocked: false } },
            ],
            should: [],
            minimum_should_match: 0,
          },
        },
        size: 10000,
        track_total_hits: true,
      };
      const query = openSearchConverter.convertRulesSearchToQuery(inputSearch);
      expect(query).to.deep.equal(expectedSearchRequest);
    });
    it('should return expected SearchResult when supplied with a rules search, requiring all clauses', () => {
      const clauses = {
        'digest.ruleIds': [1, 2, 3, 4],
        productId: [1, 2],
        'source.vendorProductId': ['vendorId'],
      };
      const inputSearch = {
        query: {
          productTypeId: 'movie',
          clauses,
        },
        pageSize: 10000,
        total: true,
      };

      const expectedSearchRequest = {
        from: 0,
        query: {
          bool: {
            filter: [
              { term: { 'status.keyword': ProductStatus.Active } },
              { term: { isBlocked: false } },
            ],
            should: [
              { terms: { 'digest.ruleIds': [1, 2, 3, 4] } },
              { terms: { _id: [1, 2] } },
              { terms: { 'source.vendorProductId.keyword': ['vendorId'] } },
            ],
            minimum_should_match: Object.keys(clauses).length,
          },
        },
        size: 10000,
        track_total_hits: true,
      };
      const query = openSearchConverter.convertRulesSearchToQuery(
        inputSearch,
        true,
      );
      expect(query).to.deep.equal(expectedSearchRequest);
    });
  });

  describe('convertSearchToQuery', () => {
    it('should return an empty search with no user criteria and enforce: false', () => {
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        {},
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should respect pagination controls', () => {
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
        size: 100,
        from: 100,
        track_total_hits: true,
      };
      const query = openSearchConverter.convertSearchToQuery(
        { pageSize: 100, pageNumber: 1, total: true },
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
  });
  describe('order by', () => {
    it('should incorporate a single orderBy', () => {
      const search: Search = { orderBy: { 'meta.length': 'ASC' } };
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [
          { 'meta.length': { order: 'ASC', missing: '_last' } },
          ...ModelFactory.defaultOpenSearchSortStatement(),
        ],
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should not use ".keyword" for orderBy date fields', () => {
      const search: Search = { orderBy: { 'meta.startDate': 'ASC' } };
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [
          { 'meta.startDate': { order: 'ASC', missing: '_last' } },
          ...ModelFactory.defaultOpenSearchSortStatement(),
        ],
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should incorporate multiple orderBys', () => {
      const search: Search = {
        orderBy: [{ 'meta.length': 'ASC' }, { 'meta.genres': 'DESC' }],
      };
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [
          { 'meta.length': { order: 'ASC', missing: '_last' } },
          { 'meta.genres.keyword': { order: 'DESC', missing: '_last' } },
          ...ModelFactory.defaultOpenSearchSortStatement(),
        ],
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('@slow should swallow pathing errors for orderBys that do not exist on the model', () => {
      const search: Search = { orderBy: [{ 'doesnotexist.test': 'ASC' }] };
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [
          { 'digest.sales.totalSales': { order: 'DESC', missing: '_last' } },
        ],
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should expand meta.basePrice orderBy to the default purchaseType for the producttype', () => {
      const search: Search = { orderBy: [{ 'meta.basePrice': 'ASC' }] };
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [
          { 'meta.basePrice.rental': { order: 'ASC', missing: '_last' } },
          ...ModelFactory.defaultOpenSearchSortStatement(),
        ],
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('given no provided orderBy, should default to digest.sales.totalSales DESC', () => {
      const search: Search = { orderBy: null };
      const expectedQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
  });
  describe('enforce', () => {
    it('should apply enforcement clauses if enforce: true (no subscription)', () => {
      const search: Search = {
        context: { enforce: true, customerId: 'I-003320', siteId: '09340' },
      };
      const expectedQuery = {
        query: {
          bool: {
            must: [],
            must_not: [],
            filter: [
              { term: { 'status.keyword': 'Active' } },
              { range: { 'meta.startDate': { lte: 'now' } } },
              { range: { 'meta.endDate': { gte: 'now' } } },
              { term: { isBlocked: false } },
            ],
            should: [
              {
                terms: {
                  'digest.whitelist.keyword': [
                    search.context.siteId,
                    search.context.customerId,
                    'GLOBAL',
                  ],
                },
              },
              {
                bool: {
                  must_not: {
                    terms: {
                      'digest.blacklist.keyword': [
                        search.context.siteId,
                        search.context.customerId,
                        'GLOBAL',
                      ],
                    },
                  },
                  must: { term: { 'digest.availableGlobally': true } },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should apply enforcement clauses if enforce: true (subscription)', () => {
      const search: Search = {
        context: {
          enforce: true,
          customerId: 'I-003320',
          siteId: '09340',
          productId: '777',
        },
      };
      const expectedQuery = {
        query: {
          bool: {
            must: [{ term: { 'digest.subscriptionProductIds': 777 } }],
            must_not: [],
            filter: [
              { term: { 'status.keyword': 'Active' } },
              { range: { 'meta.startDate': { lte: 'now' } } },
              { range: { 'meta.endDate': { gte: 'now' } } },
              { term: { isBlocked: false } },
            ],
            should: [
              {
                terms: {
                  'digest.whitelist.keyword': [
                    search.context.siteId,
                    search.context.customerId,
                    'GLOBAL',
                  ],
                },
              },
              {
                bool: {
                  must_not: {
                    terms: {
                      'digest.blacklist.keyword': [
                        search.context.siteId,
                        search.context.customerId,
                        'GLOBAL',
                      ],
                    },
                  },
                  must: { term: { 'digest.availableGlobally': true } },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should apply enforcement clauses for partial contexts', () => {
      const search: Search = {
        context: {
          enforce: true,
        },
      };
      const expectedQuery = {
        query: {
          bool: {
            must: [],
            must_not: [],
            filter: [
              { term: { 'status.keyword': 'Active' } },
              { range: { 'meta.startDate': { lte: 'now' } } },
              { range: { 'meta.endDate': { gte: 'now' } } },
              { term: { isBlocked: false } },
            ],
            should: [
              { terms: { 'digest.whitelist.keyword': ['GLOBAL'] } },
              {
                bool: {
                  must_not: {
                    terms: { 'digest.blacklist.keyword': ['GLOBAL'] },
                  },
                  must: { term: { 'digest.availableGlobally': true } },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        search,
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
  });
  describe('term search', () => {
    it('should return a meta.name query for a term search', () => {
      const expectedQuery = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  type: 'phrase',
                  fields: [
                    'meta.name',
                    'meta.cast.name',
                    'meta.directors',
                    'meta.description',
                  ],
                  query: 'elvis',
                },
              },
            ],
            must_not: [],
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        { term: 'elvis' },
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
  });
  describe('match search', () => {
    it('should deep traverse the match object and map to correct types', async () => {
      const match = {
        nested: {
          nestedString: 'Test Me',
          nestedBoolean: false,
          nestedNumber: 3.78,
          nestedArrayOfString: ['Rock'],
          arrayOfObjects: [{ name: 'Elvis Batchild (Rock)', rank: '1' }],
          doubleNestedNumber: { purchase: 0.99 },
          nestedBlankString: '',
        },
        stringField: 'Active',
        booleanField: false,
        numberField: 61687925,
        date: '2022-08-19T19:38:37.771Z',
      };
      const expectedQuery = {
        query: {
          bool: {
            must: [
              { term: { 'nested.nestedString.keyword': 'Test Me' } },
              { term: { 'nested.nestedBoolean': false } },
              { term: { 'nested.nestedNumber': 3.78 } },
              { term: { 'nested.nestedArrayOfString.keyword': 'Rock' } },
              // arrays of objects should use Match
              {
                match: {
                  'nested.arrayOfObjects.name.keyword': 'Elvis Batchild (Rock)',
                },
              },
              { match: { 'nested.arrayOfObjects.rank.keyword': '1' } },
              { term: { 'nested.doubleNestedNumber.purchase': 0.99 } },
              { term: { 'nested.nestedBlankString.keyword': '' } },
              { term: { 'stringField.keyword': 'Active' } },
              { term: { booleanField: false } },
              { term: { numberField: 61687925 } },
              { term: { 'date.keyword': '2022-08-19T19:38:37.771Z' } },
            ],
            must_not: [],
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        { match },
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
    it('should convert a match for productId into a document._id match', () => {
      const query = openSearchConverter.convertSearchToQuery(
        { match: { productId: 101 } },
        ModelFactory.productType(),
      );
      const expectedQuery = {
        query: {
          bool: {
            must: [{ term: { _id: 101 } }],
            must_not: [],
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      expect(query).to.deep.equal(expectedQuery);
    });
  });
  describe('query search', () => {
    it('should convert clauses into a query', () => {
      const expectedQuery = {
        query: {
          bool: {
            must: [
              { terms: { 'meta.name.keyword': ['elvis'] } },
              { terms: { 'meta.genres.keyword': ['Horror', 'Action'] } },
            ],
            must_not: [],
          },
        },
        sort: ModelFactory.defaultOpenSearchSortStatement(),
      };
      const query = openSearchConverter.convertSearchToQuery(
        {
          query: {
            productTypeId: 'car',
            clauses: {
              'meta.name': ['elvis'],
              'meta.genres': ['Horror', 'Action'],
            },
          },
        },
        ModelFactory.productType(),
      );
      expect(query).to.deep.equal(expectedQuery);
    });
  });
});
