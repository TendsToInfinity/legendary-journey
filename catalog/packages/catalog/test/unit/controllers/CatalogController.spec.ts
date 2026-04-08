import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { CatalogController } from '../../../src/controllers/CatalogController';
import { ProductStatus } from '../../../src/controllers/models/Product';
import { ModelFactory } from '../../utils/ModelFactory';

describe('CatalogController - Unit', () => {
  let controller: CatalogController;
  let mockCatalogManager: sinon.SinonMock;

  beforeEach(() => {
    controller = new CatalogController();
    mockCatalogManager = sinon.mock((controller as any).catalogManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getPackagesByCustomer', () => {
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

      const result = await controller.getPackagesByCustomer('I-003320');

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
  });
  describe('getPackageProductsByCustomer', () => {
    it('should return products', async () => {
      const expectedResult = [ModelFactory.product(), ModelFactory.product()];
      mockCatalogManager
        .expects('findPackageProducts')
        .withExactArgs({
          customClauses: [
            {
              clause: `
          document->'filter'->'customerId' IS NULL 
            OR document->'filter'->'customerId' = '[]'::jsonb 
            OR document->'filter'->'customerId' ? $1`,
              params: ['I-003320'],
            },
            {
              clause: `document->>'status' = $1`,
              params: [ProductStatus.Active],
            },
          ],
        })
        .resolves(expectedResult);

      const result = await controller.getPackageProductsByCustomer('I-003320');

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
  });
  describe('getPackageById', () => {
    it('should return a package', async () => {
      const packageId = '12345';
      const expectedResult = {
        name: 'test',
        id: '1',
        price: 9.99,
        description: 'a test',
        applications: [],
      };
      mockCatalogManager
        .expects('findPackageById')
        .withExactArgs(packageId)
        .resolves(expectedResult);

      const result = await controller.getPackageById(packageId);

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
    it('should throw an exception if no package is found', async () => {
      const packageId = '12345';

      mockCatalogManager
        .expects('findPackageById')
        .withExactArgs(packageId)
        .resolves(undefined);

      try {
        await controller.getPackageById(packageId);
        expect.fail();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.NotFound.name);
        expect(ex.errors).to.deep.equal([
          `No package exists with package Id = ${packageId}`,
        ]);
      }

      mockCatalogManager.verify();
    });
  });
  describe('getApplicationsByFilter', () => {
    it('should call findAllApplications if no customerId was sent', async () => {
      mockCatalogManager
        .expects('findAllApplications')
        .withExactArgs()
        .resolves();
      await controller.getApplicationsByFilter();
      mockCatalogManager.verify();
    });
    it('builds an empty customer filter', async () => {
      const tabletPackages = [ModelFactory.package(), ModelFactory.package()];
      mockCatalogManager
        .expects('findPackages')
        .withExactArgs({
          customClauses: [
            {
              clause: `document->>'status' = $1`,
              params: [ProductStatus.Active],
            },
            {
              clause: `document->'filter'->'customerId' IS NULL OR document->'filter'->'customerId' ? $1`,
              params: ['customerId'],
            },
          ],
        })
        .resolves(tabletPackages);
      const apks = await controller.getApplicationsByFilter('customerId');
      expect(apks.length).to.equal(
        _.sum(_.map(tabletPackages, (i) => i.applications.length)),
      );
      mockCatalogManager.verify();
    });
    it('builds a full customer filter', async () => {
      const tabletPackages = [ModelFactory.package()];
      mockCatalogManager
        .expects('convertSType')
        .withExactArgs('type')
        .returns('newType');
      mockCatalogManager
        .expects('findPackages')
        .withExactArgs({
          customClauses: [
            {
              clause: `document->>'status' = $1`,
              params: [ProductStatus.Active],
            },
            {
              clause: `document->'filter'->'customerId' IS NULL OR document->'filter'->'customerId' ? $1`,
              params: ['customerId'],
            },
            {
              clause: `document->'filter'->'siteId' IS NULL OR document->'filter'->'siteId' ? $1`,
              params: ['siteId'],
            },
            {
              clause: `document->'filter'->'channel' IS NULL OR document->'filter'->'channel' ? $1`,
              params: ['channel'],
            },
            {
              clause: `document->'meta'->'type' IS NULL OR document->'meta'->>'type' = ANY ($1)`,
              params: ['newType'],
            },
          ],
        })
        .resolves(tabletPackages);
      await controller.getApplicationsByFilter(
        'customerId',
        'siteId',
        'type',
        'channel',
      );
      mockCatalogManager.verify();
    });
  });
  describe('getApplicationsById', () => {
    it('should call the manager with the applicationId', async () => {
      mockCatalogManager
        .expects('findApplicationById')
        .withExactArgs('wordle')
        .resolves();
      await controller.getApplicationsById('wordle');
      mockCatalogManager.verify();
    });
  });
  describe('postLauncherConfig', () => {
    it('should return launcher workspace', async () => {
      const expectedResult = {
        workspace: [
          { type: 'shortcut', packageName: 'net.securustech.sv.staticaudio' },
          { type: 'shortcut', packageName: 'net.securustech.sv.SecureLaw' },
        ],
      };
      mockCatalogManager.expects('getLauncherConfig').resolves(expectedResult);

      const result = await controller.postLauncherConfig();

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
    it('should return default launcher workspace', async () => {
      const expectedResult = {
        workspace: [
          { type: 'shortcut', packageName: 'net.securustech.sv.staticaudio' },
          { type: 'shortcut', packageName: 'net.securustech.sv.SecureLaw' },
        ],
      };
      mockCatalogManager
        .expects('getLauncherConfig')
        .withArgs(true)
        .resolves(expectedResult);

      const result = await controller.postLauncherConfig(true);

      expect(result).to.deep.equal(expectedResult);

      mockCatalogManager.verify();
    });
  });
  describe('getLauncherConfig', () => {
    it('should call the manager', async () => {
      mockCatalogManager
        .expects('getLauncherConfig')
        .withExactArgs()
        .resolves();
      await controller.getLauncherConfig();
      mockCatalogManager.verify();
    });
  });
});
