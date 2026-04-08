import { expect } from 'chai';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { CloudDistributionManager } from '../../../src/lib/CloudDistributionManager';
import { AppConfig } from '../../../src/utils/AppConfig';

describe('CloudDistributionManager - Unit', () => {
  let cloudManager: CloudDistributionManager;
  let mockConfig: sinon.SinonMock;
  const config = Container.get(AppConfig) as AppConfig;
  beforeEach(() => {
    cloudManager = new CloudDistributionManager();
    mockConfig = sinon.mock(((cloudManager as any).config = config));
  });
  afterEach(() => {
    mockConfig.restore();
  });

  it('should return sign cloudFront URL with correct expiration time', async () => {
    const s3path = 'test';
    const productTypeId = 'track';
    // this is not a real cloudFrontKey from any environments
    const cidnFulfillmentServiceEnv: any = {
      cloudFrontKey: `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEArG9/3DhT6kmd7dRXHGVqMMaBHvhNDqzPrbxyF8X5xVP29a1N\nv7HH0oghaQ0peFj
            UeSD47HRjg55ZVZWBR4TgFP8LRtmecsKdozMfhBInWkfgegkW\n5b/Oeik1qXhmgSOoFQS3QOz9WFwSX4L+tbnIUJKrewakop2CPkKBXZciT+no4Gh+\nOxQoPEbBa7ev0
            vSAEkpeUt/byFI6Mq/kEequeFQVTzMoGMKJM5IgBkG4DiDb8psp\nkI7CkYFJaYAScMosZTvX+q9GvD1AWXFM8aaZ2uk/P1b33bKeIpZn76Q9+ketner/\nMkufCL1cuyT
            IuXgfwCan8M4smZhnuPoDuLM6JQIDAQABAoIBAG7s3zSca6cIqnan\nJU6YEsLDv6Zblr58/rBFzKNscOu2wuRyEtThGaledxesJuRLSIuPYXJCwQ2XXOKI\nZXzLhpcbJ
            nbyYVJzzZKBvaFpSDV0jXwTws4TIFFHl0SotlAWzvaObRBwI92mhQ86\nJn5iv/DNGVDwChKt/m3svGmnYqRCx2aGjrDdZy6/ShLiqtjDj+ySbOQB2HYSjTLb\nDUuB34cM
            07uCox0sImBXzmWeY4KPnkiTZPJMSa0ur399RsAIZ0gTdphrdizhBtqk\n7v8xlEc8rn1SrOA9VaY57vX6eS91H2JlLROS/V8QpNMip1i3PqRwkwLjWMErFJzl\noOmRwuE
            CgYEA2BqSXXofbI4oO4ntItZ16pGB5pv2iZoZzKUXHyO4cFpyEJx11n0A\nAwOAyl4vI/zciJ1xVzGmmxMiU+L1HPHv+DjM1PWZqLGWw92MULIDHdPr4sGY56QN\ncmOGDq
            k37llsnURG6TBUXbvrn26mXa3mZQeVJXwq8Yb0xjutZ+EU6K0CgYEAzEUX\nxIUPCa7xM2bMophGi4szcI189XhNQpuRRnK6aaMTVqc/ozuXlX413FrMZQByLAUN\n2xrAI
            EuP7XqQSfiFZyWuzxD/czS0nKggQ8wRa3HyUUmwqrKaZ8wofakZwHHyGlql\nQtjAyY4SVKUY4ZE0KO8ppadVKXjotcbn1bjEblkCgYEA1je44Uq+vbhJb4Ow+zjG\nWMj2
            kOgHwq1sZ607N1YMbetqaMcAFKeCjHo7f99PMYhmAFK52KpSMiUMgUVYnuHB\ndDix62SudkfcYLpMbm2Xo0jA6t3oOa8o2TyI1h2uYOpqPZdCB8QtzWEMF9Xyuqg4\n2+t
            hUHA+jX+vQpZDtdasCF0CgYAqAx/jTFaOcEutfbwiyNzhgGzA/miv9+E0DNjx\nO1F5vo+Qp+9fvDbuCTo8qvQU5eWVhiiWYscXHVNpzWZ1wEZ3s3ljnyRa5oErIy0X\npJ
            YEmjfzXguW4Ar/xC6jwa7JNOZNY01QFVJ5Yd4FSLt4USwAK0hOiL7sO7DpChLO\nkyTbaQKBgQDJNLGkP1qcFWQDm2NxWAuCmhiwt6L1FTcSM9P/s4qPFa3MOA9Ui34J\nF
            0pgNQY+6YM5m1Zxlddpgr3YMBd6jZKFs00OlZROLhEBLNxzRDo1ZxGB4nMkOse7\neF4ZyMRKEpri7bGYqYx/5ispaFixjtwZWTtc+A7EXe1U5vzCWoYqJA==\n-----END RSA PRIVATE KEY-----`,
      cloudFrontPublicKeyId: 'WHEREVER',
      urlExpiresHours: '1',
      cloudFrontDistribution: 'fake.host.name',
      enabled: true,
    };
    mockConfig
      .expects('get')
      .withExactArgs('cidnFulfillmentService')
      .atLeast(1)
      .returns(cidnFulfillmentServiceEnv);

    const cloudFrontPublicKeyId: string =
      cidnFulfillmentServiceEnv.cloudFrontPublicKeyId;
    const urlExpiresHours: string = cidnFulfillmentServiceEnv.urlExpiresHours;

    const expiresHours =
      urlExpiresHours === undefined ? 1 : parseInt(urlExpiresHours, 10);
    const signPath = await cloudManager.signPathForCloudFront(
      s3path,
      productTypeId,
    );

    const signPathUrl = new URL(signPath);
    const expiresTime = signPathUrl.searchParams.get('Expires') || '0';
    const timeToExpire =
      Math.round(
        parseInt(expiresTime, 10) - Math.floor(new Date().getTime() / 1000),
      ) /
      (60 * 60); // should be less then timeToExpire - so round it

    expect(signPathUrl.pathname).to.deep.equal(`/${s3path}`);
    expect(timeToExpire).to.deep.equal(expiresHours);
    expect(signPathUrl.searchParams.get('Key-Pair-Id')).to.deep.equal(
      cloudFrontPublicKeyId,
    );
  });

  it('should return sign cloudFront URL with correct expiration time when productTypeId is ebooks', async () => {
    const s3path = 'test';
    const productTypeId = 'ebook';
    // this is not a real cloudFrontKey from any environments
    const ebooksConfig: any = {
      cloudFrontKey: `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEArG9/3DhT6kmd7dRXHGVqMMaBHvhNDqzPrbxyF8X5xVP29a1N\nv7HH0oghaQ0peFj
            UeSD47HRjg55ZVZWBR4TgFP8LRtmecsKdozMfhBInWkfgegkW\n5b/Oeik1qXhmgSOoFQS3QOz9WFwSX4L+tbnIUJKrewakop2CPkKBXZciT+no4Gh+\nOxQoPEbBa7ev0
            vSAEkpeUt/byFI6Mq/kEequeFQVTzMoGMKJM5IgBkG4DiDb8psp\nkI7CkYFJaYAScMosZTvX+q9GvD1AWXFM8aaZ2uk/P1b33bKeIpZn76Q9+ketner/\nMkufCL1cuyT
            IuXgfwCan8M4smZhnuPoDuLM6JQIDAQABAoIBAG7s3zSca6cIqnan\nJU6YEsLDv6Zblr58/rBFzKNscOu2wuRyEtThGaledxesJuRLSIuPYXJCwQ2XXOKI\nZXzLhpcbJ
            nbyYVJzzZKBvaFpSDV0jXwTws4TIFFHl0SotlAWzvaObRBwI92mhQ86\nJn5iv/DNGVDwChKt/m3svGmnYqRCx2aGjrDdZy6/ShLiqtjDj+ySbOQB2HYSjTLb\nDUuB34cM
            07uCox0sImBXzmWeY4KPnkiTZPJMSa0ur399RsAIZ0gTdphrdizhBtqk\n7v8xlEc8rn1SrOA9VaY57vX6eS91H2JlLROS/V8QpNMip1i3PqRwkwLjWMErFJzl\noOmRwuE
            CgYEA2BqSXXofbI4oO4ntItZ16pGB5pv2iZoZzKUXHyO4cFpyEJx11n0A\nAwOAyl4vI/zciJ1xVzGmmxMiU+L1HPHv+DjM1PWZqLGWw92MULIDHdPr4sGY56QN\ncmOGDq
            k37llsnURG6TBUXbvrn26mXa3mZQeVJXwq8Yb0xjutZ+EU6K0CgYEAzEUX\nxIUPCa7xM2bMophGi4szcI189XhNQpuRRnK6aaMTVqc/ozuXlX413FrMZQByLAUN\n2xrAI
            EuP7XqQSfiFZyWuzxD/czS0nKggQ8wRa3HyUUmwqrKaZ8wofakZwHHyGlql\nQtjAyY4SVKUY4ZE0KO8ppadVKXjotcbn1bjEblkCgYEA1je44Uq+vbhJb4Ow+zjG\nWMj2
            kOgHwq1sZ607N1YMbetqaMcAFKeCjHo7f99PMYhmAFK52KpSMiUMgUVYnuHB\ndDix62SudkfcYLpMbm2Xo0jA6t3oOa8o2TyI1h2uYOpqPZdCB8QtzWEMF9Xyuqg4\n2+t
            hUHA+jX+vQpZDtdasCF0CgYAqAx/jTFaOcEutfbwiyNzhgGzA/miv9+E0DNjx\nO1F5vo+Qp+9fvDbuCTo8qvQU5eWVhiiWYscXHVNpzWZ1wEZ3s3ljnyRa5oErIy0X\npJ
            YEmjfzXguW4Ar/xC6jwa7JNOZNY01QFVJ5Yd4FSLt4USwAK0hOiL7sO7DpChLO\nkyTbaQKBgQDJNLGkP1qcFWQDm2NxWAuCmhiwt6L1FTcSM9P/s4qPFa3MOA9Ui34J\nF
            0pgNQY+6YM5m1Zxlddpgr3YMBd6jZKFs00OlZROLhEBLNxzRDo1ZxGB4nMkOse7\neF4ZyMRKEpri7bGYqYx/5ispaFixjtwZWTtc+A7EXe1U5vzCWoYqJA==\n-----END RSA PRIVATE KEY-----`,
      cloudFrontPublicKeyId: 'WHEREVER',
      urlExpiresHours: '1',
      cloudFrontDistribution: 'fake.host.name',
      enabled: true,
    };
    mockConfig
      .expects('get')
      .withExactArgs('ebook')
      .atLeast(1)
      .returns(ebooksConfig);

    const cloudFrontPublicKeyId: string = ebooksConfig.cloudFrontPublicKeyId;
    const urlExpiresHours: string = ebooksConfig.urlExpiresHours;

    const expiresHours =
      urlExpiresHours === undefined ? 1 : parseInt(urlExpiresHours, 10);
    const signPath = await cloudManager.signPathForCloudFront(
      s3path,
      productTypeId,
    );

    const signPathUrl = new URL(signPath);
    const expiresTime = signPathUrl.searchParams.get('Expires') || '0';
    const timeToExpire =
      Math.round(
        parseInt(expiresTime, 10) - Math.floor(new Date().getTime() / 1000),
      ) /
      (60 * 60); // should be less then timeToExpire - so round it

    expect(signPathUrl.pathname).to.deep.equal(`/${s3path}`);
    expect(timeToExpire).to.deep.equal(expiresHours);
    expect(signPathUrl.searchParams.get('Key-Pair-Id')).to.deep.equal(
      cloudFrontPublicKeyId,
    );
  });

  it('should return false if cidnFulfillmentService is undefined', async () => {
    mockConfig
      .expects('get')
      .withExactArgs('cidnFulfillmentService')
      .returns(undefined);
    const isEnabled = await cloudManager.isEnabled();

    expect(isEnabled).to.deep.equal(false);
  });
});
