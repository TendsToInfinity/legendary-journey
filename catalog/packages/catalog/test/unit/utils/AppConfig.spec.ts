import { ConfigSource } from '@securustablets/libraries.config';
import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as faker from 'faker';
import * as mockRequire from 'mock-require';
import * as sinon from 'sinon';
import { AppConfig } from '../../../src/utils/AppConfig';

describe('AppConfig', () => {
  let appConfig: AppConfig;

  beforeEach(() => {
    appConfig = new AppConfig();
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  function fullConfig() {
    return [
      { name: 'elastic', source: ConfigSource.NodeConfig },
      { name: 'listenPort', source: ConfigSource.NodeConfig },
      { name: 'log.level', source: ConfigSource.NodeConfig },
      { name: 'log.format', source: ConfigSource.NodeConfig },
      { name: 'openSearch.host', source: ConfigSource.NodeConfig },
      { name: 'openSearch.user', source: ConfigSource.NodeConfig },
      { name: 'openSearch.pass', source: ConfigSource.NodeConfig },
      { name: 'postgres.host', source: ConfigSource.NodeConfig },
      { name: 'postgres.port', source: ConfigSource.NodeConfig },
      { name: 'postgres.user', source: ConfigSource.NodeConfig },
      { name: 'postgres.password', source: ConfigSource.NodeConfig },
      { name: 'postgres.database', source: ConfigSource.NodeConfig },
      { name: 'rmq.host', source: ConfigSource.NodeConfig },
      { name: 'rmq.virtualHost', source: ConfigSource.NodeConfig },
      { name: 'rmq.user', source: ConfigSource.NodeConfig },
      { name: 'rmq.password', source: ConfigSource.NodeConfig },
      { name: 'security.jwt.publicKey', source: ConfigSource.NodeConfig },
      { name: 'security.jwt.issuerUrls', source: ConfigSource.NodeConfig },
      { name: 'security.apiKey.keys', source: ConfigSource.NodeConfig },
      { name: 'signedData.publicKey', source: ConfigSource.NodeConfig },
      { name: 'signedData.jwtExpiry', source: ConfigSource.NodeConfig },
      { name: 'signedData.privateKey', source: ConfigSource.NodeConfig },
    ];
  }

  it('should require AppConfig properties', () => {
    try {
      setConfig(appConfig, [
        {
          name: 'foo',
          value: 'bar',
          source: ConfigSource.NodeConfig,
        },
      ]);
      appConfig.validate();
      expect.fail();
    } catch (err) {
      expect(parseErrors(err)).to.deep.equal(fullConfig());
    }
  });

  it('should pass validation when all AppConfig props present', () => {
    setConfig(appConfig, fullConfig());
    appConfig.validate();
  });

  it('should provide accessors', () => {
    const accessors = [
      'apm',
      'elastic',
      'listenPort',
      'log',
      'security',
      'signedData',
      'postgres',
      'rmq',
      'eligibilityService',
      'features',
      'allowTestApis',
      'openSearch',
    ];
    accessors.forEach((i) => {
      sinon
        .stub(appConfig as any, 'get')
        .withArgs(i)
        .returns('test passed');
      expect(appConfig[i]).to.equal('test passed');
      sinon.verifyAndRestore();
    });
  });

  it('should return a default feature', () => {
    sinon
      .stub(appConfig as any, 'get')
      .withArgs('features')
      .returns(undefined);
    expect(appConfig.features).to.deep.equal({});
  });

  it('should return a default cache object', () => {
    sinon
      .stub(appConfig as any, 'get')
      .withArgs('cache')
      .returns(undefined);
    expect(appConfig.cache).to.deep.equal({
      tier1: {},
      tier3: {},
      ttlMicro: 0,
      ttlTiny: 0,
      ttlShort: 0,
      ttlMedium: 0,
      ttlLong: 0,
    });
  });

  it('should return default catalog local media', () => {
    sinon
      .stub(appConfig as any, 'get')
      .withArgs('catalogLocalMedia')
      .returns(undefined);
    expect(appConfig.catalogLocalMedia).to.deep.equal({
      catalogUseLocalMedia: false,
    });
  });

  it('should return dd trace enabled', () => {
    sinon
      .stub(appConfig as any, 'get')
      .withArgs('DD_TRACE_ENABLED', { source: ConfigSource.Env })
      .returns('true');
    expect(appConfig.ddTraceEnabled).to.equal(true);
  });

  it('should return AWS X-ray trace enabled', () => {
    sinon
      .stub(appConfig as any, 'get')
      .withArgs('AWS_XRAY_ENABLED', { source: ConfigSource.Env })
      .returns('true');
    expect(appConfig.awsXrayEnabled).to.equal(true);
  });

  function setConfig(conf: AppConfig, confProps: any) {
    const nodeConfig = buildConfig(confProps, ConfigSource.NodeConfig);
    _.set(conf, 'nodeConfig', nodeConfig);
    sinon.verifyAndRestore();
  }

  // Shh...
  function buildConfig(props: any, source: ConfigSource) {
    return _.mapValues(
      _.mapKeys(_.filter(props, { source }), 'name'),
      (configValue: any) =>
        _.isUndefined(configValue.value)
          ? faker.hacker.noun()
          : configValue.value,
    );
  }

  // idk man, you got any better ideas?
  function parseErrors(err: any) {
    return JSON.parse(
      err.message.split(
        'The following configuration properties failed validation: ',
      )[1],
    ).map((i) => ({
      name: i.name,
      source: i.source,
    }));
  }
});
