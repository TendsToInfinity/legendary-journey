import { _ } from '@securustablets/libraries.utils';
import { Inject, Singleton } from 'typescript-ioc';
import {
  PricedProduct,
  ProductTypeIds,
  ThumbnailApprovedStatus,
} from '../../../controllers/models/Product';
import { Context } from '../../../controllers/models/Search';
import { AppConfig } from '../../../utils/AppConfig';
import { Decorator } from '../../ProductDecoratorManager';

@Singleton
export class ThumbnailDecorator {
  @Inject
  private config!: AppConfig;

  private get cidnFulfillmentService() {
    return this.config.cidnFulfillmentService;
  }

  // When adding or changing decorator fields also update getDecoratorFields to reflect these new values
  public decorator: Decorator = async (
    products: PricedProduct[],
    context: Context,
  ): Promise<void> => {
    _.forEach(products, (product) => {
      if (
        context.enforce &&
        !_.isEmpty(product.meta.thumbnailApproved) &&
        product.meta.thumbnailApproved !== ThumbnailApprovedStatus.Approved
      ) {
        if (!_.isEmpty(product.meta.genres)) {
          const defaultJpegName = product.meta.genres[0]
            .toLowerCase()
            .replace(/[^a-zA-Z0-9\\s]/g, '');
          const url = this.cidnFulfillmentService.cloudFrontArtUrl;
          const subfolder = this.cidnFulfillmentService.cloudFrontArtSubfolder;
          product.meta.thumbnail = `${url}/${product.productTypeGroupId}/${subfolder}/${defaultJpegName}.jpeg`;
        } else {
          product.meta.thumbnail = null;
        }
      }
      // Enforce https for thumbnails, except games those aren't supported yet
      if (
        product.meta.thumbnail &&
        product.productTypeId != ProductTypeIds.Game
      ) {
        product.meta.thumbnail = _.replace(
          product.meta.thumbnail,
          'http://',
          'https://',
        );
      }
    });
  };

  public getDecoratorFields(): string[] {
    return [];
  }
}
