import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { LegacyApk } from '../../../src/controllers/models/LegacyApk';
import { ProductStatus } from '../../../src/controllers/models/Product';
import { app } from '../../../src/main';
import { AppConfig } from '../../../src/utils/AppConfig';
import * as client from '../../utils/client';
import { catalog, pgCatalog } from '../../utils/data/SvCatalog';
import { describeEsIntegration, esTestClient } from '../EsIntegrationTest';

// tslint:disable-next-line
require('chai').use(require('chai-as-promised'));

describe('CatalogController', function () {
  this.timeout(10000);
  const apiKey = (Container.get(AppConfig) as AppConfig).security.apiKey
    .keys[0];

  beforeEach(async () => {
    await client.bulk(pgCatalog());
    await client.clearCache();
  });

  describe('Get Package By Id', () => {
    it('should get package', () => {
      return request(app)
        .get(`/catalog/packages/kankakeeSubscriber`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(Object.keys(response.body)).to.have.lengthOf(10);
          expect(response.body).to.haveOwnProperty('price').that.is.equal(30);
          expect(response.body)
            .to.haveOwnProperty('description')
            .that.is.a('string');
          expect(response.body).to.haveOwnProperty('demo').that.is.equal(false);
        });
    });
    it('should return errors for unknown package', () => {
      return request(app)
        .get(`/catalog/packages/unknown`)
        .set('x-api-key', apiKey)
        .expect(404)
        .then((response) => {
          expect(Object.keys(response.body)).to.have.lengthOf(1);
          expect(response.body)
            .to.haveOwnProperty('errors')
            .that.has.lengthOf(1);
          expect(response.body.errors[0]).to.equal(
            'No package exists with package Id = unknown',
          );
        });
    });
  });
  describe('Get Package By CustomerId', () => {
    it('should get packages for customer', () => {
      return request(app)
        .get(`/catalog/packages/customers/I-002960`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(3);
          const personalPackage = response.body.find(
            (p) =>
              p.filters?.customerId?.includes('I-002960') &&
              p.filters?.siteId?.includes('12345'),
          );
          expect(Object.keys(personalPackage)).to.have.lengthOf(10);
          expect(personalPackage)
            .to.haveOwnProperty('modelNumber')
            .that.equals('nexus7');
          expect(personalPackage)
            .to.haveOwnProperty('deviceFeatures')
            .that.deep.equals(['bluetooth']);
          expect(personalPackage)
            .to.haveOwnProperty('filters')
            .that.deep.equals({ customerId: ['I-002960'], siteId: ['12345'] });
          expect(personalPackage)
            .to.haveOwnProperty('type')
            .that.deep.equals('personal');
          expect(
            _.filter(response.body, (p) => _.startsWith(p.name, 'Ingham'))
              .length,
          ).to.equal(2);
          expect(personalPackage)
            .to.haveOwnProperty('description')
            .that.is.a('string');
        });
    });
    it('should get default packages for unknown customer', () => {
      return request(app)
        .get(`/catalog/packages/customers/unknown`)
        .set('x-api-key', apiKey)
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
          expect(response.body[0]).to.haveOwnProperty('filters');
          expect(response.body[0])
            .to.haveOwnProperty('type')
            .that.deep.equals('officer');
          expect(response.body[0])
            .to.haveOwnProperty('name')
            .that.includes('Officer');
          expect(response.body[0])
            .to.haveOwnProperty('description')
            .that.is.a('string');
        });
    });
  });
  describe('getPackageProductsByCustomer', () => {
    it('should return products matching customerId, null customerId filter, and empty array customerId filter', async () => {
      const customerId = 'I-002960';
      const catalog = pgCatalog().filter(
        (p) =>
          p.productTypeId === 'tabletPackage' &&
          p.status === ProductStatus.Active,
      );

      // Since this is relying on non-random seeded data
      // want to ensure the expected results are consistent and one of each clause exists
      const expectedCustomerNames = catalog
        .filter((p) => _.get(p, 'filter.customerId', []).includes(customerId))
        .map((p) => p.meta.name);
      const expectedNullFilterNames = catalog
        .filter((p) => !_.get(p, 'filter.customerId'))
        .map((p) => p.meta.name);
      const expectedEmptyArrayNames = catalog
        .filter((p) => _.isEqual(_.get(p, 'filter.customerId'), []))
        .map((p) => p.meta.name);

      expect(expectedCustomerNames.length).to.be.greaterThan(0);
      expect(expectedNullFilterNames.length).to.be.greaterThan(0);
      expect(expectedEmptyArrayNames.length).to.be.greaterThan(0);

      const response = await request(app)
        .get(`/catalog/packages/customers/${customerId}/products`)
        .set('x-api-key', apiKey)
        .expect(200);

      const customerPackages = _.filter(response.body, (p) =>
        _.get(p, 'filter.customerId', []).includes(customerId),
      ).map((p) => p.meta.name);
      const nullFilterPackages = _.filter(
        response.body,
        (p) => !_.get(p, 'filter.customerId'),
      ).map((p) => p.meta.name);
      const emptyArrayPackages = _.filter(response.body, (p) =>
        _.isEqual(_.get(p, 'filter.customerId'), []),
      ).map((p) => p.meta.name);

      expect(customerPackages.sort()).to.deep.equal(
        expectedCustomerNames.sort(),
      );
      expect(nullFilterPackages.sort()).to.deep.equal(
        expectedNullFilterNames.sort(),
      );
      expect(emptyArrayPackages.sort()).to.deep.equal(
        expectedEmptyArrayNames.sort(),
      );
    });
  });
  describe('Get Applications By Id', () => {
    it('should get application', () => {
      return request(app)
        .get(`/catalog/applications/net.securustech.sv.svcontrol`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          const apk: LegacyApk = response.body;
          const expectedKeys = [
            'id',
            'packageName',
            'category',
            'name',
            'description',
            'isSystemApp',
            'isPrivileged',
            'postInstallCommand',
            'allowAppManagement',
          ];
          expect(Object.keys(response.body)).to.deep.equal(expectedKeys);
          expect(apk.name).to.equal('svControl');
        });
    });
    it('should return errors', () => {
      return request(app)
        .get(`/catalog/applications/unknown`)
        .set('x-api-key', apiKey)
        .expect(404)
        .then((response) => {
          expect(Object.keys(response.body)).to.have.lengthOf(1);
          expect(response.body)
            .to.haveOwnProperty('errors')
            .that.has.lengthOf(1);
          expect(response.body.errors[0]).to.equal(
            'No application exists with application Id = unknown',
          );
        });
    });
  });
  describe('Get Applications By Filter', () => {
    it('should get all application when no customer is provided', () => {
      return request(app)
        .get(`/catalog/applications/`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(25);
          const expectedKeys = [
            'id',
            'packageName',
            'category',
            'name',
            'description',
            'isSystemApp',
            'isPrivileged',
            'postInstallCommand',
            'allowAppManagement',
          ];
          expect(
            Object.keys(
              _.find(response.body, ['id', 'net.securustech.sv.svcontrol']),
            ),
          ).to.deep.equal(expectedKeys);
        });
    });
    it('should get application when customer is provided as query string', () => {
      return request(app)
        .get(`/catalog/applications?customerId=I-002960`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(18);
          expect(
            _.filter(response.body, (a) => a.category === 'system').length,
          ).to.equal(5);
        });
    });
    it('should get application when customer and stype (ot) is provided as query string', () => {
      return request(app)
        .get(`/catalog/applications?customerId=I-002960&stype=ot`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(6);
          expect(
            _.filter(response.body, (a) => a.category === 'system').length,
          ).to.equal(5);
        });
    });
    it('should get application when customer and stype (st) is provided as query string', () => {
      return request(app)
        .get(`/catalog/applications?customerId=I-002960&stype=st`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(14);
        });
    });
    it('should get only default application when customer and invalid siteId is provided as query string', () => {
      return request(app)
        .get(`/catalog/applications?customerId=I-002960&siteId=9876&stype=st`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body).to.have.lengthOf(0);
        });
    });
    it('should return default applications when no customer is provided', () => {
      return request(app)
        .get(`/catalog/applications?customerId=unknown`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(Object.keys(response.body)).to.have.lengthOf(6);
          expect(
            _.filter(response.body, (a) => a.category === 'system').length,
          ).to.equal(5);
        });
    });
  });
  describeEsIntegration('Get Application Config', () => {
    beforeEach(async () => {
      await esTestClient.seed({
        data: {
          sv_catalog: {
            application_config: catalog().application_config,
          },
        },
      });
    });

    it('should get the application launcher config with a GET request', () => {
      return request(app)
        .get(`/catalog/launcher/`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body)
            .to.haveOwnProperty('workspace')
            .that.is.an('array')
            .that.has.lengthOf(2);
          expect(response.body.workspace[0])
            .to.haveOwnProperty('type')
            .that.is.oneOf(['widget', 'shortcut']);
        });
    });
    it('should get the application launcher config with a POST request', () => {
      return request(app)
        .post(`/catalog/launcher/`)
        .set('x-api-key', apiKey)
        .expect(200)
        .then((response) => {
          expect(response.body)
            .to.haveOwnProperty('workspace')
            .that.is.an('array')
            .that.has.lengthOf(2);
          expect(response.body.workspace[0])
            .to.haveOwnProperty('type')
            .that.is.oneOf(['widget', 'shortcut']);
        });
    });
    it('should return an empty workspace at the endpoint', () => {
      return esTestClient.client
        .deleteAsync({
          index: 'sv_catalog',
          type: 'application_config',
          id: 'net.securustech.sv.launcher',
        })
        .then(() => {
          return request(app)
            .get(`/catalog/launcher/`)
            .set('x-api-key', apiKey)
            .expect(200);
        })
        .then((response) => {
          expect(response.body)
            .to.haveOwnProperty('workspace')
            .that.is.an('array')
            .that.has.lengthOf(0);
        });
    });
  });
});
