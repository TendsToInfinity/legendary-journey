import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as faker from 'faker';
import { ClauseConverter } from '../../../src/data/ClauseConverter';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ClauseConverter', () => {
  let clauseConverter: ClauseConverter;

  beforeEach(() => {
    clauseConverter = new ClauseConverter();
  });

  describe('convertTo', () => {
    it('should convert empty clauses', () => {
      expect(
        clauseConverter.convertTo({}, ModelFactory.testMovieSchema()),
      ).to.deep.equal([]);
    });
    it('should convert basic clauses', () => {
      const pgClauses = clauseConverter.convertTo(
        {
          'meta.year': [2006],
        },
        ModelFactory.testMovieSchema(),
      );
      expect(pgClauses).to.deep.equal([
        {
          meta: {
            year: 2006,
          },
        },
      ]);
    });
    it('should convert many queries', () => {
      const pgClauses = clauseConverter.convertTo(
        {
          'meta.cast.name': ['Bill Murray', 'Tom Hanks'],
          'meta.cast.roles': ['Garfield', 'Forrest Gump'],
          'meta.genres': ['Action', 'Drama', 'Adventure'],
          'meta.rating': ['PG', 'PG-13', 'TV-PG'],
          'meta.year': [2006],
          'meta.name': ['Snow White'],
          'meta.basePrice.rental': [2.99],
        },
        ModelFactory.testMovieSchema(),
      );

      expect(pgClauses).to.deep.equal([
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
      ]);
    });
  });

  describe('convertFrom', () => {
    it('should convert empty match', () => {
      expect(clauseConverter.convertFrom([], true)).to.deep.equal({});
      expect(clauseConverter.convertFrom([], false)).to.deep.equal({});
      expect(clauseConverter.convertFrom([])).to.deep.equal({});
    });
    it('should convert basic match', () => {
      const clauses = clauseConverter.convertFrom([
        {
          meta: {
            year: 2006,
          },
        },
      ]);
      expect(clauses).to.deep.equal({
        'meta.year': [2006],
      });
    });
    it('should convert many matches', () => {
      const clauses = clauseConverter.convertFrom([
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Bill Murray', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Garfield'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Action'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Drama'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'PG-13',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
        {
          meta: {
            cast: [{ name: 'Tom Hanks', roles: ['Forrest Gump'] }],
            genres: ['Adventure'],
            rating: 'TV-PG',
            year: 2006,
            name: 'Snow White',
            basePrice: {
              rental: 2.99,
            },
          },
        },
      ]);
      expect(clauses).to.deep.equal({
        'meta.cast.name': ['Bill Murray', 'Tom Hanks'],
        'meta.cast.roles': ['Garfield', 'Forrest Gump'],
        'meta.genres': ['Action', 'Drama', 'Adventure'],
        'meta.rating': ['PG', 'PG-13', 'TV-PG'],
        'meta.year': [2006],
        'meta.name': ['Snow White'],
        'meta.basePrice.rental': [2.99],
      });
    });
  });

  describe('convertToWhereClauses', () => {
    it('should convert empty match to empty where clause', async () => {
      expect(
        await clauseConverter.convertToWhereClauses(
          [],
          ModelFactory.testMovieSchema(),
          faker.random.word(),
        ),
      ).to.deep.equal([]);
    });
    it('should convert match to where clause', async () => {
      expect(
        await clauseConverter.convertToWhereClauses(
          [
            {
              meta: {
                year: 2006,
              },
            },
          ],
          ModelFactory.testMovieSchema(),
          'movie',
        ),
      ).to.deep.equal([
        { isArray: [false], key: ['meta.year'], value: [[2006]] },
      ]);
    });
    it('should convert complicated match to appropriate where clause', async () => {
      expect(
        _.sortBy(
          await clauseConverter.convertToWhereClauses(
            [
              {
                productTypeGroupId: 'movie',
                productTypeId: 'movie',
                source: {
                  vendorName: 'Movie Provider',
                  vendorProductId: 'pId',
                },
                meta: {
                  genres: ['Pop'],
                  test: 'test',
                },
              },
            ],
            ModelFactory.testAlbumSchema(),
            'album',
          ),
          (i) => i.key[0],
        ),
      ).to.deep.equal(
        _.sortBy(
          [
            {
              isArray: [false],
              key: ['productTypeGroupId'],
              value: [['movie']],
            },
            { isArray: [false], key: ['productTypeId'], value: [['movie']] },
            {
              isArray: [false],
              key: ['source.vendorName'],
              value: [['Movie Provider']],
            },
            {
              isArray: [false],
              key: ['source.vendorProductId'],
              value: [['pId']],
            },
            { isArray: [true], key: ['meta.genres'], value: [['Pop']] },
            { isArray: [false], key: ['meta.test'], value: [['test']] },
          ],
          (i) => i.key[0],
        ),
      );
    });
    it('should convert complicated match arrays to appropriate where clause', async () => {
      expect(
        await clauseConverter.convertToWhereClauses(
          [
            {
              productTypeId: 'movie',
              meta: {
                cast: [
                  {
                    name: 'name of the cast',
                    roles: ['ACTOR', 'DIRECTOR'],
                  },
                ],
              },
            },
          ],
          ModelFactory.testMovieSchema(),
          'movie',
        ),
      ).to.deep.equal([
        { isArray: [false], key: ['productTypeId'], value: [['movie']] },
        {
          isArray: [true],
          key: ['meta.cast'],
          value: [[{ name: 'name of the cast', roles: ['ACTOR', 'DIRECTOR'] }]],
        },
      ]);
    });
  });
});
