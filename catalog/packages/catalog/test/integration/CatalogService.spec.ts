/**
 * Created by adonai 3/28/2018
 */
import { expect } from 'chai';
import * as request from 'supertest';
import { app } from '../../src/main';

describe('CatalogService', () => {
  it('should serve swagger.json', () => {
    return request(app)
      .get('/swagger.json')
      .expect(200)
      .then((response) => {
        expect(response).to.be.an('object');
      });
  });
});
