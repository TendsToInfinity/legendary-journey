import { _, findPkgRootSync } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as jwt from 'jsonwebtoken';
import * as ms from 'ms';
import * as path from 'path';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { TokenManager } from '../../../src/lib/TokenManager';
import { AppConfig } from '../../../src/utils/AppConfig';
import { ModelFactory } from '../../utils/ModelFactory';

describe('TokenManager - Unit', () => {
  let manager: TokenManager;
  let publicKey: string;
  let expiry: string;
  let clock: sinon.SinonFakeTimers;
  let mockConfig: sinon.SinonMock;
  const config = Container.get(AppConfig) as AppConfig;
  before(async () => {
    publicKey = fs.readFileSync(
      path.resolve(findPkgRootSync(__dirname), config.signedData.publicKey),
      'utf8',
    );
    expiry = config.signedData.jwtExpiry;
  });
  beforeEach(() => {
    manager = new TokenManager();
    mockConfig = sinon.mock(((manager as any).config = config));
    clock = sinon.useFakeTimers();
  });
  afterEach(() => {
    clock.restore();
    mockConfig.restore();
  });

  it('should return valid jwt', async () => {
    const payload = ModelFactory.purchaseToken();
    const token = await manager.generateJwt(payload);
    let resultPayload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as any;
    const { iat, exp } = resultPayload;
    resultPayload = _.omit(resultPayload, 'iat', 'exp');
    expect(iat).to.equal(0);
    expect(exp).to.equal(ms(expiry) / 1000);
    expect(resultPayload).to.deep.equal(payload);
  });

  it('jwt should not expire before expiration time', async () => {
    const payload = ModelFactory.purchaseToken();

    const token = await manager.generateJwt(payload);
    const expiryMs = ms(expiry);
    clock.tick(expiryMs - 1);

    expect(() =>
      jwt.verify(token, publicKey, { algorithms: ['RS256'] }),
    ).to.not.throw();
  });

  it('jwt should expire after expiration time', async () => {
    const payload = ModelFactory.purchaseToken();

    const token = await manager.generateJwt(payload);
    const expiryMs = ms(expiry);
    clock.tick(expiryMs);

    expect(() =>
      jwt.verify(token, publicKey, { algorithms: ['RS256'] }),
    ).to.throw(jwt.TokenExpiredError);
  });
});
