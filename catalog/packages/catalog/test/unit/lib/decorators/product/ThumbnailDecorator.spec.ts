import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import {
  PricedProduct,
  ProductTypeIds,
  ThumbnailApprovedStatus,
} from '../../../../../src/controllers/models/Product';
import { ThumbnailDecorator } from '../../../../../src/lib/decorators/product/ThumbnailDecorator';
import { AppConfig } from '../../../../../src/utils/AppConfig';
import { ModelFactory } from '../../../../utils/ModelFactory';

describe('ThumbnailDecorator - Unit', () => {
  const sandbox = sinon.createSandbox();
  let subscriptionDecorator: ThumbnailDecorator;
  let mockConfig: sinon.SinonMock;
  const config = Container.get(AppConfig) as AppConfig;

  beforeEach(() => {
    subscriptionDecorator = new ThumbnailDecorator();
    mockConfig = sinon.mock(((subscriptionDecorator as any).config = config));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('decorate', () => {
    it('should update thumbnails to https', async () => {
      let products: PricedProduct[] = [];
      const thumbnail = 'http://pleasefixmethx.com';

      products = [
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
          },
        } as any as PricedProduct),
      ];
      await subscriptionDecorator.decorator(products, { enforce: false });
      expect(products[0].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals('https://pleasefixmethx.com');
    });
    it('should not update game thumbnails to https', async () => {
      let products: PricedProduct[] = [];
      const thumbnail = 'http://pleasedontfixmethx.com';

      products = [
        ModelFactory.pricedProduct({
          productId: 15,
          productTypeId: ProductTypeIds.Game,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
          },
        } as any as PricedProduct),
      ];
      await subscriptionDecorator.decorator(products, { enforce: false });
      expect(products[0].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals('http://pleasedontfixmethx.com');
    });
    it('should not update url to https if no thumbnail', async () => {
      let products: PricedProduct[] = [];

      products = [
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
          },
        } as any as PricedProduct),
      ];
      delete products[0].meta.thumbnail;
      await subscriptionDecorator.decorator(products, { enforce: false });
      expect(products[0].meta).to.not.haveOwnProperty('thumbnail');
    });
    it('should update meta.thumbnail to null since meta.thumbnailApproval status is not approved and product has no genres', async () => {
      let products: PricedProduct[] = [];
      const thumbnail = ModelFactory.httpsThumbnail;

      products = [
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
          },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 123,
          meta: { thumbnail },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Blocked,
          },
        } as any as PricedProduct),
      ];
      await subscriptionDecorator.decorator(products, { enforce: true });
      expect(products[0].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
      expect(products[1].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
      expect(products[2].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(null);
    });
    it('should update meta.thumbnail to default art URL if meta.thumbnailApproval status is not approved and product has genres', async () => {
      let products: PricedProduct[] = [];
      const thumbnail = ModelFactory.httpsThumbnail;

      products = [
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
          },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 123,
          meta: { thumbnail },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Blocked,
            genres: ['Action'],
          },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 16,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Blocked,
            genres: ['Soul/R&B'],
          },
        } as any as PricedProduct),
      ];

      const cidnFulfillmentService: AppConfig['cidnFulfillmentService'] = {
        cloudFrontKey: '',
        cloudFrontPublicKeyId: '',
        urlExpiresHours: '1',
        cloudFrontDistribution: '',
        cloudFrontArtUrl: ModelFactory.httpsThumbnail,
        cloudFrontArtSubfolder: faker.random.word(),
      };
      mockConfig
        .expects('get')
        .atLeast(1)
        .withExactArgs('cidnFulfillmentService')
        .returns(cidnFulfillmentService);

      const cloudFrontArtUrl = cidnFulfillmentService.cloudFrontArtUrl;
      const cloudFrontArtSubfolder =
        cidnFulfillmentService.cloudFrontArtSubfolder;

      await subscriptionDecorator.decorator(products, { enforce: true });

      expect(products[0].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
      expect(products[1].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
      expect(products[2].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(
          `${cloudFrontArtUrl}/${products[2].productTypeGroupId}/${cloudFrontArtSubfolder}/action.jpeg`,
        );
      expect(products[3].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(
          `${cloudFrontArtUrl}/${products[3].productTypeGroupId}/${cloudFrontArtSubfolder}/soulrb.jpeg`,
        );
    });
    it('should return meta.thumbnail as is if context.enforce is false even if meta.thumbnailApproval status is not approved', async () => {
      let products: PricedProduct[] = [];
      const thumbnail = ModelFactory.httpsThumbnail;

      products = [
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
          },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 123,
          meta: { thumbnail },
        } as any as PricedProduct),
        ModelFactory.pricedProduct({
          productId: 15,
          meta: {
            thumbnail,
            thumbnailApproved: ThumbnailApprovedStatus.Blocked,
          },
        } as any as PricedProduct),
      ];
      await subscriptionDecorator.decorator(products, { enforce: false });
      expect(products[0].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
      expect(products[1].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
      expect(products[2].meta)
        .to.haveOwnProperty('thumbnail')
        .that.deep.equals(thumbnail);
    });
  });

  describe('getDecoratorFields', () => {
    let products: PricedProduct[] = [];

    beforeEach(() => {
      products = [
        ModelFactory.pricedProduct({ productId: 123 } as any as PricedProduct),
      ];
    });

    describe('getDecoratorFields', () => {
      it('should not return any new fields since its just updates the value of the existing', async () => {
        const decoratorFields = subscriptionDecorator.getDecoratorFields();
        expect(decoratorFields).to.deep.equal([]);
      });
    });
  });
});
