import { CorpJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import * as request from 'supertest';
import { app } from '../../../src/main';
import * as client from '../../utils/client';
import { pgCatalog } from '../../utils/data/SvCatalog';
import '../global.spec';

// tslint:disable-next-line
require('chai').use(require('chai-as-promised'));

describe('FilterController', function () {
  this.timeout(5000);
  let myToken = '';
  beforeEach(async () => {
    await client.bulk(pgCatalog());
    const expectedJwt = {
      jwtType: JwtType.Corporate,
      username: 'testy',
      permissions: ['catalogAdmin'],
    } as CorpJwt;
    myToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(expectedJwt));
  });
  describe('Get Packages By Filter', () => {
    it('should get packages for customer if filter only contains customer ID', () => {
      return request(app)
        .post(`/catalog/packages/filter`)
        .set('Authorization', `Bearer ${myToken}`)
        .send({ customerId: 'I-002960' })
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(3);
          expect(Object.keys(response.body[0])).to.have.lengthOf(10);
          expect(response.body[0])
            .to.haveOwnProperty('modelNumber')
            .that.equals('nexus7');
          expect(response.body[0])
            .to.haveOwnProperty('deviceFeatures')
            .that.deep.equals(['bluetooth']);
          expect(response.body[0])
            .to.haveOwnProperty('type')
            .that.deep.equals('personal');
          expect(response.body[0])
            .to.haveOwnProperty('filters')
            .that.deep.equals({ customerId: ['I-002960'], siteId: ['12345'] });
          expect(
            _.filter(response.body, (p) => _.startsWith(p.name, 'Ingham'))
              .length,
          ).to.equal(2);
        });
    });
    it('should get default packages for unknown customer', () => {
      return request(app)
        .post(`/catalog/packages/filter`)
        .set('Authorization', `Bearer ${myToken}`)
        .send({ customerId: 'unknown' })
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(1);
          expect(Object.keys(response.body[0])).to.have.lengthOf(10);
          expect(response.body[0])
            .to.haveOwnProperty('modelNumber')
            .that.equals('nexus7');
          expect(response.body[0])
            .to.haveOwnProperty('deviceFeatures')
            .that.deep.equals(['bluetooth']);
          expect(response.body[0])
            .to.haveOwnProperty('type')
            .that.equals('officer');
          expect(response.body[0]).to.haveOwnProperty('filters');
          expect(response.body[0])
            .to.haveOwnProperty('name')
            .that.includes('Officer');
        });
    });
    it('should get packages for filter customer ID and tabletRole(stype) - officer', () => {
      return request(app)
        .post(`/catalog/packages/filter`)
        .set('Authorization', `Bearer ${myToken}`)
        .send({ customerId: 'I-002960', stype: 'ot' })
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(1);
          expect(Object.keys(response.body[0])).to.have.lengthOf(10);
          expect(response.body[0])
            .to.haveOwnProperty('name')
            .that.includes('Officer');
        });
    });
    it('should get packages for filter customer ID and tabletRole(stype) - personal', () => {
      return request(app)
        .post(`/catalog/packages/filter`)
        .set('Authorization', `Bearer ${myToken}`)
        .send({ customerId: 'I-002960', stype: 'st' })
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(1);
          expect(Object.keys(response.body[0])).to.have.lengthOf(10);
          expect(response.body[0])
            .to.haveOwnProperty('name')
            .that.includes('Ingham');
        });
    });
    it('should throw error for bad filter', () => {
      return request(app)
        .post(`/catalog/packages/filter`)
        .set('Authorization', `Bearer ${myToken}`)
        .send({ knicknack: 'paddywack' })
        .expect(400)
        .then((response) => {
          expect(Object.keys(response.body)).to.have.lengthOf(1);
          expect(response.body)
            .to.haveOwnProperty('errors')
            .that.has.lengthOf(2);
          expect(response.body.errors[0])
            .to.be.an('object')
            .that.has.ownProperty('message')
            .that.includes('additional property');
          expect(response.body.errors[1])
            .to.be.an('object')
            .that.has.ownProperty('message')
            .that.includes('requires');
        });
    });
  });
});
