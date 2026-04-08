import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { ContextConfigManager } from '@securustablets/libraries.context-config';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { Fee } from '../../../controllers/models/Fee';
import {
  PriceDetailType,
  Product,
  ProductTypeIds,
  PurchaseOption,
  PurchasePriceDetail,
} from '../../../controllers/models/Product';
import { RuleType } from '../../../controllers/models/Rule';
import { Context } from '../../../controllers/models/Search';
import { FeeDao } from '../../../data/PGCatalog/FeeDao';
import { AppConfig } from '../../../utils/AppConfig';
import { DigestManager } from '../../DigestManager';
import { EligibilityManager } from '../../EligibilityManager';
import { FeeManager } from '../../FeeManager';
import { Decorator } from '../../ProductDecoratorManager';
import { Config } from '../../models/Config';

@Singleton
export class PriceDecorator {
  @Inject
  private feeDao!: FeeDao;

  @Inject
  private eligibilityManager!: EligibilityManager;

  @Inject
  private feeManager!: FeeManager;

  @Inject
  private digestManager!: DigestManager;

  @Inject
  private contextConfigManager!: ContextConfigManager;

  @Inject
  private config!: AppConfig;

  private mediaProductTypes = [
    'album',
    'ebook',
    'ebookSubscription',
    'game',
    'gameSubscription',
    'movie',
    'movieSubscription',
    'track',
    'tvEpisode',
    'tvShow',
  ];

  // When adding or changing decorator fields also update getDecoratorFields to reflect these new values
  public decorator: Decorator = async (
    products: Product[],
    context: Context,
  ): Promise<void> => {
    await this.decorateEffectivePriceAndSubscriptionIds(products, context);

    let fees = [...(await this.feeDao.findByContextWithJsonClauses(context))]; // Don't mutate cached arrays
    fees = this.filterOutInactiveFees(fees);
    const eligibility = await this.eligibilityManager.getEligibility();
    const catalogConfigs = await this.getCatalogConfigs(
      context.customerId,
      context.siteId,
    );
    await Bluebird.map(
      products,
      async (product) => {
        product.purchaseOptions = [];
        if (this.localMediaPurchaseOptionSkip(product)) {
          product.purchaseOptions = [];
        } else if (
          product.source &&
          product.source.availableForPurchase === false
        ) {
          product.purchaseOptions = _.compact([
            await this.buildPurchaseOptionForMemberProduct(product),
          ]);
        } else if (
          !eligibility.disableMediaPurchase ||
          (eligibility.disableMediaPurchase &&
            !this.mediaProductTypes.includes(product.productTypeId))
        ) {
          product.purchaseOptions = _.compact(
            _.flatten([
              _.map(_.keys(this.getEffectivePrice(product)), (purchaseTypeId) =>
                this.buildPurchaseOptionForProduct(
                  purchaseTypeId,
                  product,
                  fees,
                  catalogConfigs,
                ),
              ),
              await this.buildPurchaseOptionForMemberProduct(product),
            ]),
          );
        }
      },
      { concurrency: 10 },
    );
  };

  /**
   * Compares purchaseTypeRestrictions for current purchaseType and productType
   * @returns True if purchaseTypeRestriction is enabled for purchaseTypeId and productTypeId
   */
  private isPurchaseTypeRestricted(
    purchaseTypeId: string,
    productTypeId: string,
    catalogConfigs: Config,
  ): boolean {
    return catalogConfigs.disablePurchaseType[purchaseTypeId].includes(
      productTypeId,
    );
  }

  private filterOutInactiveFees(fees: Fee[]): Fee[] {
    const zeroFees = _.remove(fees, ['amount', 0]);

    // If there aren't any zero dollar fees all fees apply
    if (zeroFees.length === 0) {
      return fees;
    }

    // If there is a zero fee at the site level remove all customer and global fees, allow other site level fees for that productTypeId
    // If there is a zero fee at the customer level remove all global fees, allow other customer level fees for that productTypeId
    // Remove all fees for a global zero fee for that productTypeId
    _.forEach(zeroFees, (zeroFee) => {
      if (zeroFee.siteId) {
        _.remove(
          fees,
          (fee) => !fee.siteId && fee.productTypeId === zeroFee.productTypeId,
        );
      } else if (zeroFee.customerId) {
        _.remove(
          fees,
          (fee) =>
            !fee.customerId && fee.productTypeId === zeroFee.productTypeId,
        );
      } else {
        _.remove(fees, (fee) => fee.productTypeId === zeroFee.productTypeId);
      }
    });
    return fees;
  }

  private getEffectivePrice(product: Product) {
    return _.merge({}, product.meta.basePrice, product.meta.effectivePrice);
  }

  private async buildPurchaseOptionForMemberProduct(
    product: Product,
  ): Promise<PurchaseOption | undefined> {
    const subscriptionPurchaseOption = {
      type: 'subscription',
      totalPrice: 0,
      priceDetails: [
        {
          name: 'Price',
          amount: 0,
          type: PriceDetailType.Price,
        },
      ],
    };

    if (product.subscriptionIds && !_.isEmpty(product.subscriptionIds)) {
      return subscriptionPurchaseOption;
    }
    return;
  }

  private buildPurchaseOptionForProduct(
    purchaseTypeId: string,
    product: Product,
    fees: Fee[],
    catalogConfigs: Config,
  ): PurchaseOption | undefined {
    // convert all decimal amounts to integers
    const to = (amount: number) => Math.round(100 * amount);
    // convert an integer representation back to decimal
    const fro = (amount: number) => amount / 100;

    const effectivePrice = this.getEffectivePrice(product)[purchaseTypeId];
    let totalPrice = to(effectivePrice);
    const feeDetails: PurchasePriceDetail[] = [];
    if (effectivePrice !== 0) {
      // Check purchaseTypeRestriction and skip purchase option if ordering is disabled
      if (
        this.isPurchaseTypeRestricted(
          purchaseTypeId,
          product.productTypeId,
          catalogConfigs,
        )
      ) {
        return;
      }

      fees.forEach((fee) => {
        if (this.feeManager.productMatchesFee(fee, product)) {
          const feeAmount = !fee.percent
            ? fee.amount
            : fro(Math.round(fro(fee.amount) * to(effectivePrice)));
          totalPrice += to(feeAmount);
          feeDetails.push({
            name: fee.name,
            amount: feeAmount,
            type: PriceDetailType.Fee,
          });
        }
      });
    }
    return {
      type: purchaseTypeId,
      totalPrice: fro(totalPrice),
      priceDetails: [
        { name: 'Price', amount: effectivePrice, type: PriceDetailType.Price },
        ...feeDetails,
      ],
    };
  }

  private async decorateEffectivePriceAndSubscriptionIds(
    products,
    context,
  ): Promise<void> {
    const productTypeIds = _.uniq(_.map(products, 'productTypeId'));
    const rules = await this.digestManager.getRulesByProductType(
      context,
      productTypeIds,
      [RuleType.ProductSubscriptionAvailability, RuleType.ProductPrice],
    );
    if (!_.isEmpty(rules)) {
      products.map((product) => {
        const digest = this.digestManager.getProductDigest(rules, product);
        product.meta.effectivePrice = this.digestManager.getEffectivePrice(
          context,
          digest,
        );
        // TODO Remove after deprecation of postgres search
        product.subscriptionIds = digest.subscriptionProductIds;
      });
    }
  }

  private localMediaPurchaseOptionSkip(product: Product) {
    if (this.config.catalogLocalMedia.catalogUseLocalMedia) {
      if (product.productTypeId === ProductTypeIds.Track) {
        return !product.source.s3Path;
      } else if (product.productTypeId === ProductTypeIds.Album) {
        const nonLocalValue = _.find(
          product.childProducts,
          (p: Product) => !p.source.s3Path,
        );
        return Boolean(nonLocalValue);
      }
    }
    return false;
  }

  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
  })
  private async getCatalogConfigs(
    customerId?: string,
    siteId?: string,
  ): Promise<Config> {
    if (!customerId || !siteId) {
      return {
        disablePurchaseType: { rental: [], subscription: [], purchase: [] },
      };
    }
    return (
      await this.contextConfigManager.resolveConfigs<Config>(customerId, siteId)
    ).config;
  }

  public getDecoratorFields(): string[] {
    return ['meta.effectivePrice', 'purchaseOptions', 'subscriptionIds'];
  }
}
