import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { WorkspaceItemType } from '../../../src/controllers/models/Launcher';
import { ApplicationConfigDao } from '../../../src/data/ESCatalog/ApplicationConfigDao';
import { AppConfig } from '../../../src/utils/AppConfig';
import { MockConfig } from '../../utils/MockConfig';

describe('ApplicationConfigDao', () => {
  let applicationConfigDao: ApplicationConfigDao;
  let mockEsClient: sinon.SinonMock;

  beforeEach(() => {
    Container.snapshot(AppConfig);
    const config = new MockConfig();
    Container.bind(AppConfig).provider({ get: () => config });
    config.add('elastic', '!elastic');
    applicationConfigDao = new ApplicationConfigDao();
    mockEsClient = sinon.mock((applicationConfigDao as any)._client);
  });

  afterEach(() => {
    Container.restore(AppConfig);
    sinon.restore();
  });

  it('should return a launcherConfig from the db', async () => {
    const testWorkspace = {
      workspace: [
        { type: WorkspaceItemType.Shortcut, packageName: 'test.com' },
      ],
    };
    mockEsClient
      .expects('getAsync')
      .withExactArgs({
        index: 'sv_catalog',
        type: 'application_config',
        id: 'net.securustech.sv.launcher',
      })
      .resolves({ _id: 'net.securustech.sv.launcher', _source: testWorkspace });
    expect(await applicationConfigDao.getLauncherConfig()).to.deep.equal(
      testWorkspace,
    );
    sinon.verify();
  });

  it('should return an empty config', async () => {
    const testWorkspace = { workspace: [] };
    mockEsClient.expects('getAsync').never();
    expect(await applicationConfigDao.getLauncherConfig(true)).to.deep.equal(
      testWorkspace,
    );
    sinon.verify();
  });

  it('should return an empty config on error', async () => {
    const testWorkspace = { workspace: [] };
    mockEsClient.expects('getAsync').rejects(Exception.NotFound());
    expect(await applicationConfigDao.getLauncherConfig()).to.deep.equal(
      testWorkspace,
    );
    sinon.verify();
  });
});
