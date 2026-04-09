import { assert } from 'chai';
import { Container } from 'typescript-ioc';
import { CatalogManager } from '../../../src/lib/CatalogManager';
import { assertIsSorted } from '../../utils/AssertUtils';
import * as client from '../../utils/client';
import { catalog } from '../../utils/data/SvCatalog';
import { describeEsIntegration, esTestClient } from '../EsIntegrationTest';
// tslint:disable-next-line
require('chai').use(require('chai-as-promised'));

const cust = Container.get(CatalogManager);
describeEsIntegration('CatalogManager', () => {
  beforeEach(async () => {
    await client.clearCache();
    return esTestClient.seed({
      data: {
        sv_catalog: {
          application_config: catalog().application_config,
        },
      },
    });
  });
  describe('Catalog Concept', () => {
    describe('getLauncherConfig', () => {
      it('should return the launcher configuration with all apps from catalog appended in consistent order', () => {
        return cust.getLauncherConfig().then((config) => {
          const workspace = config.workspace;
          assert.equal(workspace.length, 2);
          assert.equal(
            workspace[0].packageName,
            'net.securustech.sv.homeappwidget',
          );
          assert.equal(
            workspace[1].packageName,
            'net.securustech.sv.subscriber',
          );
        });
      });
      it('should return an empty workspace if no configuration is found', () => {
        return esTestClient.client
          .deleteAsync({
            index: 'sv_catalog',
            type: 'application_config',
            id: 'net.securustech.sv.launcher',
          })
          .then(() => {
            return cust.getLauncherConfig();
          })
          .then((launcher) => {
            const workspace = launcher.workspace;
            assert.equal(workspace.length, 0);
            assertIsSorted(workspace, { field: 'packageName' });
          });
      });
    });
  });
});
