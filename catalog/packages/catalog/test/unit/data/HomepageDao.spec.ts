import { assert } from 'chai';
import { HomepageDao } from '../../../src/data/PGCatalog/HomepageDao';

describe('HomepageDao - Unit', () => {
  describe('construct', () => {
    it('constructs', () => {
      const homepageDao = new HomepageDao();
      assert.isObject(homepageDao, 'It did not construct');
    });
  });
});
