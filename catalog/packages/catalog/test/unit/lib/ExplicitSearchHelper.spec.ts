import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { PricedProduct } from '../../../src/controllers/models/Product';
import { Search } from '../../../src/controllers/models/Search';
import { ExplicitSearchHelper } from '../../../src/lib/ExplicitSearchHelper';
import { Paginated } from '../../../src/lib/models/Paginated';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ExplicitSearchHelper - Unit', () => {
  describe('checkExplicitField', () => {
    it('handles normal orderBy', async () => {
      const search: Search = {
        query: {
          productTypeId: 'cookie',
          clauses: {
            productId: [1, 2, 3, 4, 5],
          },
        },
        orderBy: { 'meta.startDate': 'ASC' },
        pageSize: 3,
        pageNumber: 1,
      };
      const explicitOrderBy = ExplicitSearchHelper.checkExplicitField(search);
      expect(explicitOrderBy).to.be.undefined;
    });
    it('handles EXPLICIT orderBy', async () => {
      const search: Search = {
        query: {
          productTypeId: 'oregano',
          clauses: {
            productId: [1, 2, 3, 4, 5],
          },
        },
        orderBy: { productId: 'EXPLICIT' },
        pageSize: 3,
        pageNumber: 1,
      };
      const explicitOrderBy = ExplicitSearchHelper.checkExplicitField(search);
      expect(explicitOrderBy).to.equal('productId');
    });
    it('throws for EXPLICIT orderBy when multiple orderBys passed in', async () => {
      const search: Search = {
        query: {
          productTypeId: 'lemon',
          clauses: {
            productId: [2342, 23],
          },
        },
        orderBy: [{ productId: 'EXPLICIT' }, { 'meta.year': 'DESC' }],
      };
      try {
        ExplicitSearchHelper.checkExplicitField(search);
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
        assert.equal(err.message, 'EXPLICIT OrderBy only supports one OrderBy');
      }
      sinon.verify();
    });
    it('throw for EXPLICIT orderBy when field value missing', async () => {
      const search: Search = {
        query: {
          productTypeId: 'coconut',
          clauses: {
            'source.vendorProductId': ['apple'],
          },
        },
        orderBy: [{ productId: 'EXPLICIT' }],
      };
      try {
        ExplicitSearchHelper.checkExplicitField(search);
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
        assert.equal(
          err.message,
          'Field Values are missing in Input JSON for EXPLICIT sort order',
        );
      }
      sinon.verify();
    });
    it('throw for EXPLICIT orderBy when search uses match', async () => {
      const search: Search = {
        match: {
          productId: [32, 23, 56, 11],
        },
        orderBy: [{ productId: 'EXPLICIT' }],
      };
      try {
        ExplicitSearchHelper.checkExplicitField(search);
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
        assert.equal(
          err.message,
          'EXPLICIT OrderBy only supported with Query Search',
        );
      }
      sinon.verify();
    });
    it('throw for EXPLICIT orderBy when more than 100 clause values', async () => {
      const search: Search = {
        query: {
          productTypeId: 'taco',
          clauses: {
            productId: [...Array(104).keys()],
          },
        },
        orderBy: [{ productId: 'EXPLICIT' }],
      };
      try {
        ExplicitSearchHelper.checkExplicitField(search);
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
        assert.equal(err.message, 'Maximum number of clause values is 100');
      }
      sinon.verify();
    });
  });
  describe('mutateExplicitSearchQuery', () => {
    it('transforms search', async () => {
      const search: Search = {
        query: {
          productTypeId: 'soda',
          clauses: {
            productId: [1, 2, 3, 4, 5],
          },
        },
        orderBy: { productId: 'EXPLICIT' },
        pageSize: 3,
        pageNumber: 1,
      };
      const mutatedSearch = ExplicitSearchHelper.mutateExplicitSearchQuery(
        search,
        'productId',
      );
      expect(mutatedSearch.orderBy).to.be.empty;
      expect(mutatedSearch.pageSize).to.equal(5);
      expect(mutatedSearch.pageNumber).to.equal(0);
    });
  });
  describe('mutateExplicitSearchReturn', () => {
    it('transforms paginated return', async () => {
      const search: Search = {
        query: {
          productTypeId:
            'trailMix or should it be trailmix idk webstorm thinks its a typo',
          clauses: {
            productId: [1, 7, 3, 2, 9],
          },
        },
        orderBy: { productId: 'EXPLICIT' },
        pageSize: 2,
        pageNumber: 0,
      };
      const mutatedSearch = ExplicitSearchHelper.mutateExplicitSearchQuery(
        _.cloneDeep(search),
        'productId',
      );
      const initalReturn: Paginated<PricedProduct> = {
        data: [1, 2, 3, 7, 9].map((productId) =>
          ModelFactory.pricedProduct({ productId: productId }),
        ),
        pageNumber: 0,
        pageSize: 5,
      };
      const mutatedReturn = ExplicitSearchHelper.mutateExplicitSearchReturn(
        mutatedSearch,
        'productId',
        _.cloneDeep(initalReturn),
        search.pageSize,
        search.pageNumber,
      );

      // Validate products come back ordered correctly with correct pagination data
      expect(mutatedReturn).to.deep.equal({
        data: [initalReturn.data[0], initalReturn.data[3]],
        pageSize: 2,
        pageNumber: 0,
      });
    });
    it('defaults pageSize and pageNumber when missing', async () => {
      const search: Search = {
        query: {
          productTypeId: 'orange',
          clauses: {
            productId: [5, 7, 12, 95, 3, 2],
          },
        },
        orderBy: { productId: 'EXPLICIT' },
      };
      const mutatedSearch = ExplicitSearchHelper.mutateExplicitSearchQuery(
        _.cloneDeep(search),
        'productId',
      );
      const initalReturn: Paginated<PricedProduct> = {
        data: [7, 5, 95, 12, 3, 2].map((productId) =>
          ModelFactory.pricedProduct({ productId: productId }),
        ),
        pageNumber: 0,
        pageSize: 6,
      };
      const mutatedReturn = ExplicitSearchHelper.mutateExplicitSearchReturn(
        mutatedSearch,
        'productId',
        _.cloneDeep(initalReturn),
        search.pageSize,
        search.pageNumber,
      );

      // Validate products come back ordered correctly with correct pagination data
      expect(mutatedReturn).to.deep.equal({
        data: [
          initalReturn.data[1],
          initalReturn.data[0],
          initalReturn.data[3],
          initalReturn.data[2],
          initalReturn.data[4],
          initalReturn.data[5],
        ],
        pageSize: 100,
        pageNumber: 0,
      });
    });
  });
});
