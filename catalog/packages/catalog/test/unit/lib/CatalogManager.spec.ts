import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { CatalogManager } from '../../../src/lib/CatalogManager';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('CatalogManager - Unit', () => {
  const sandbox = sinon.createSandbox();
  let manager: CatalogManager;
  let mockProductManager: sinon.SinonMock;
  let mockApplicationConfigDao: sinon.SinonMock;

  beforeEach(async () => {
    const stubGetSchemaForInterface = sandbox.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    manager = new CatalogManager();
    mockProductManager = sandbox.mock((manager as any).productManager);
    mockApplicationConfigDao = sandbox.mock(
      (manager as any)._applicationConfigDao,
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getLauncherConfig', () => {
    it('should retrieve the launcher config', async () => {
      const expectedResponse = {
        workspace: [
          {
            type: 'widget',
            packageName: 'com.test',
          },
        ],
      };
      mockApplicationConfigDao
        .expects('getLauncherConfig')
        .returns(expectedResponse);

      const result = await manager.getLauncherConfig();

      expect(result).to.deep.equal(expectedResponse);

      mockApplicationConfigDao.verify();
    });
    it('should retrieve the default launcher workspace', async () => {
      const expectedResponse = {
        workspace: [
          {
            type: 'widget',
            packageName: 'com.test',
          },
        ],
      };
      mockApplicationConfigDao
        .expects('getLauncherConfig')
        .withArgs(true)
        .returns(expectedResponse);

      const result = await manager.getLauncherConfig(true);

      expect(result).to.deep.equal(expectedResponse);

      mockApplicationConfigDao.verify();
    });
  });

  describe('findApplicationById', () => {
    it('should find an application by applicationId', async () => {
      const applicationId = 'com.test.application';
      const pricedProduct = ModelFactory.pricedProduct();

      mockProductManager
        .expects('findOne')
        .withExactArgs({
          customClauses: [
            {
              clause: `document->'meta'->>'androidClass' = $1`,
              params: [applicationId],
            },
            { clause: `document->>'productTypeId' = $1`, params: ['apk'] },
          ],
        })
        .resolves(pricedProduct);
      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.productId, true)
        .resolves(pricedProduct);

      const result = await manager.findApplicationById(applicationId);

      expect(result).to.deep.equal(
        (manager as any).productToApk(pricedProduct),
      );

      mockProductManager.verify();
    });
    it('should find an application by productId', async () => {
      const applicationId = 1;
      const pricedProduct = ModelFactory.pricedProduct();

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(applicationId, true)
        .resolves(pricedProduct);

      const result = await manager.findApplicationById(
        applicationId.toString(),
      );

      expect(result).to.deep.equal(
        (manager as any).productToApk(pricedProduct),
      );

      mockProductManager.verify();
    });
    it('should throw an exception if no product is found when finding an application by applicationId', async () => {
      const applicationId = 'com.test.application';

      mockProductManager
        .expects('findOne')
        .withExactArgs({
          customClauses: [
            {
              clause: `document->'meta'->>'androidClass' = $1`,
              params: [applicationId],
            },
            { clause: `document->>'productTypeId' = $1`, params: ['apk'] },
          ],
        })
        .resolves();

      try {
        await manager.findApplicationById(applicationId);
        expect.fail();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.NotFound.name);
        expect(ex.errors).to.deep.equal([
          `No application exists with application Id = ${applicationId}`,
        ]);
      }

      mockProductManager.verify();
    });
  });
  describe('findAllApplications', () => {
    it('should find all applications', async () => {
      const pricedProduct = ModelFactory.pricedProduct();
      const findOptions = {
        customClauses: [
          {
            clause: `document->>'productTypeId' = $1`,
            params: [(CatalogManager as any).APK_PRODUCT_TYPE_ID],
          },
        ],
        pageSize: Number.MAX_SAFE_INTEGER,
      };
      const expectedResult = {
        id: 'com.test',
        packageName: 'com.test',
        category: 'system',
        name: 'test',
        description: 'A test apk',
        isSystemApp: true,
        isPrivileged: false,
        postInstallCommand: 'test something',
        allowAppManagement: false,
      };
      const productToApkStub = sinon
        .stub(manager as any, 'productToApk')
        .returns(expectedResult);

      mockProductManager
        .expects('find')
        .withExactArgs(findOptions)
        .resolves([pricedProduct]);

      const result = await manager.findAllApplications();

      expect(productToApkStub.calledWithExactly(pricedProduct)).to.equal(true);
      expect(result[0]).to.deep.equal(expectedResult);

      mockProductManager.verify();
    });
  });
  describe('findPackageById', () => {
    it('should find a package by packageId', async () => {
      const packageId = 'My Test Package';
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const expectedResult = (manager as any).productToPackage(pricedProduct);
      const findPackagesStub = sinon
        .stub(manager, 'findPackages')
        .resolves([expectedResult]);

      const result = await manager.findPackageById(packageId);

      expect(
        findPackagesStub.calledWithExactly({
          customClauses: [
            {
              clause: `document->'source'->>'vendorProductId' = $1`,
              params: [packageId],
            },
          ],
        }),
      ).to.equal(true);
      expect(result).to.deep.equal(
        (manager as any).productToPackage(pricedProduct),
      );
    });
    it('should find a package by productId', async () => {
      const packageId = 1;
      const pricedProduct = ModelFactory.pricedPackageWithChildren();

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(packageId, true)
        .resolves(pricedProduct);

      const result = await manager.findPackageById(packageId.toString());

      expect(result).to.deep.equal(
        (manager as any).productToPackage(pricedProduct),
      );

      mockProductManager.verify();
    });
    it('should find a package by productId with empty device features list', async () => {
      const packageId = 1;
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      delete pricedProduct.childProducts[0].meta.features;

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(packageId, true)
        .resolves(pricedProduct);

      const result = await manager.findPackageById(packageId.toString());

      expect(result).to.deep.equal(
        (manager as any).productToPackage(pricedProduct),
      );

      mockProductManager.verify();
    });
  });
  describe('findPackages', () => {
    it('should find packages', async () => {
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const findOptions = {
        customClauses: [
          {
            clause: `document->>'productTypeId' = $1`,
            params: [(CatalogManager as any).TABLET_PACKAGE_PRODUCT_TYPE_ID],
          },
        ],
        pageSize: Number.MAX_SAFE_INTEGER,
      };
      const expectedResult = {
        name: 'test',
        id: '1',
        price: 9.99,
        description: 'a test',
        applications: [],
      };
      const productToPackageStub = sinon
        .stub(manager as any, 'productToPackage')
        .returns(expectedResult);

      mockProductManager
        .expects('find')
        .withExactArgs(findOptions)
        .resolves([pricedProduct]);
      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.productId, true)
        .resolves(pricedProduct);

      const result = await manager.findPackages({});

      expect(productToPackageStub.calledWithExactly(pricedProduct)).to.equal(
        true,
      );
      expect(result[0]).to.deep.equal(expectedResult);

      mockProductManager.verify();
    });
  });
  describe('findPackageProducts', () => {
    it('should find package products without mapping to Package', async () => {
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const findOptions = {
        customClauses: [
          {
            clause: `document->>'productTypeId' = $1`,
            params: [(CatalogManager as any).TABLET_PACKAGE_PRODUCT_TYPE_ID],
          },
        ],
        pageSize: Number.MAX_SAFE_INTEGER,
      };

      mockProductManager
        .expects('find')
        .withExactArgs(findOptions)
        .resolves([pricedProduct]);

      const result = await manager.findPackageProducts({});

      expect(result).to.deep.equal([pricedProduct]);

      sinon.verify();
    });

    it('should merge custom clauses into find options', async () => {
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const customClause = {
        clause: `document->'filter'->'customerId' IS NULL OR document->'filter'->'customerId' ? $1`,
        params: ['I-003320'],
      };
      const findOptions = {
        customClauses: [
          customClause,
          {
            clause: `document->>'productTypeId' = $1`,
            params: [(CatalogManager as any).TABLET_PACKAGE_PRODUCT_TYPE_ID],
          },
        ],
        pageSize: Number.MAX_SAFE_INTEGER,
      };

      mockProductManager
        .expects('find')
        .withExactArgs(findOptions)
        .resolves([pricedProduct]);

      const result = await manager.findPackageProducts({
        customClauses: [customClause],
      });

      expect(result).to.deep.equal([pricedProduct]);

      sinon.verify();
    });
  });
  describe('convertSType', () => {
    it('should convert st', async () => {
      expect(manager.convertSType('st')).to.eql('{personal}');
    });
    it('should convert wrong', async () => {
      expect(manager.convertSType('st2')).to.eql(undefined);
    });
    it('should convert ot', async () => {
      expect(manager.convertSType('ot')).to.eql('{officer}');
    });
    it('should convert ft', async () => {
      expect(manager.convertSType('ft')).to.eql('{community}');
    });
  });
  describe('convert product methods', () => {
    it('should convert products to packages and apks', async () => {
      const apkProduct1 = {
        productId: 111,
        productTypeId: 'apk',
        meta: {
          category: 'category?',
          compatibility: [],
          name: 'Test apk 1',
          description: 'A fake apk',
          androidClass: 'com.test.fake.1',
          appManagementAllowed: true,
          privilegedApp: false,
          systemApp: false,
        },
        postInstallCommand: 'test',
      };
      const apkProduct2 = {
        productId: 222,
        productTypeId: 'apk',
        meta: {
          category: 'category?',
          compatibility: [],
          name: 'Test apk 2',
          description: 'Also a fake apk',
          androidClass: 'com.test.fake.2',
          appManagementAllowed: true,
          privilegedApp: true,
          systemApp: true,
        },
        postInstallCommand: 'test 2',
      };
      const apkProduct3 = {
        productId: 333,
        productTypeId: 'apk',
        meta: {
          category: 'another category?',
          compatibility: [],
          name: 'Test apk 3',
          androidClass: 'com.test.fake.3',
          appManagementAllowed: false,
          privilegedApp: true,
          systemApp: false,
        },
        postInstallCommand: 'test 3',
      };
      const deviceProduct = {
        productId: 4444,
        productTypeId: 'device',
        childProductIds: [apkProduct2.productId, apkProduct3.productId],
        childProducts: [apkProduct2, apkProduct3],
        fulfillmentType: 'physical',
        meta: {
          name: 'Test Device',
          description: 'A test device',
          modelNumber: 'TEST-MODEL',
          features: {
            camera: true,
            oled: false,
            bluetooth: true,
          },
        },
      };
      const packageProduct = {
        productId: 555,
        productTypeId: 'tabletPackage',
        childProductIds: [
          apkProduct1.productId,
          apkProduct2.productId,
          deviceProduct.productId,
        ],
        childProducts: [apkProduct1, apkProduct2, deviceProduct],
        purchaseCode: 'TABLET',
        purchaseTypes: ['subscription'],
        purchaseOptions: [{ type: 'subscription', totalPrice: 50.99 }],
        meta: {
          type: 'personal',
          name: 'Test package',
          description: 'A package for testing',
          demo: false,
        },
        filter: {
          customerId: ['I-003320'],
        },
      };
      const expectedResult = {
        name: packageProduct.meta.name,
        id: packageProduct.productId.toString(),
        price: packageProduct.purchaseOptions[0].totalPrice,
        description: packageProduct.meta.description,
        deviceFeatures: ['camera', 'bluetooth'], // Hardcoding this to verify conversion
        modelNumber: deviceProduct.meta.modelNumber,
        type: packageProduct.meta.type,
        filters: packageProduct.filter,
        applications: [
          {
            id: apkProduct1.meta.androidClass,
            packageName: apkProduct1.meta.androidClass,
            category: apkProduct1.meta.category,
            name: apkProduct1.meta.name,
            description: apkProduct1.meta.description,
            isSystemApp: apkProduct1.meta.systemApp,
            isPrivileged: apkProduct1.meta.privilegedApp,
            postInstallCommand: apkProduct1.postInstallCommand,
            allowAppManagement: apkProduct1.meta.appManagementAllowed,
          },
          {
            id: apkProduct2.meta.androidClass,
            packageName: apkProduct2.meta.androidClass,
            category: apkProduct2.meta.category,
            name: apkProduct2.meta.name,
            description: apkProduct2.meta.description,
            isSystemApp: apkProduct2.meta.systemApp,
            isPrivileged: apkProduct2.meta.privilegedApp,
            postInstallCommand: apkProduct2.postInstallCommand,
            allowAppManagement: apkProduct2.meta.appManagementAllowed,
          },
          {
            id: apkProduct3.meta.androidClass,
            packageName: apkProduct3.meta.androidClass,
            category: apkProduct3.meta.category,
            name: apkProduct3.meta.name,
            description: undefined,
            isSystemApp: apkProduct3.meta.systemApp,
            isPrivileged: apkProduct3.meta.privilegedApp,
            postInstallCommand: apkProduct3.postInstallCommand,
            allowAppManagement: apkProduct3.meta.appManagementAllowed,
          },
        ],
        demo: false,
      };

      const result = (manager as any).productToPackage(packageProduct);

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
