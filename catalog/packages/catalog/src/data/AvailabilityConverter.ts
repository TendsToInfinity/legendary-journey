import { Singleton } from 'typescript-ioc';
import {
  Availability,
  AvailabilityCheckName,
} from '../controllers/models/AvailabilityCheck';

export enum AvailabilityCheckKey {
  Policy = 'policy',
  ActiveStatus = 'activeStatus',
  ActiveDateRange = 'activeDateRange',
  ProductTypeAvailabile = 'productTypeAvailabile',
  Blacklisted = 'blacklisted',
  Whitelisted = 'whitelisted',
}

export enum AvailabilityPolicy {
  Whitelist = 'whitelist',
  Blacklist = 'blacklist',
}

@Singleton
export class AvailabilityConverter {
  public convertFrom({
    productId,
    available,
    availabilityChecks: dbChecks,
  }: any): Availability {
    const activeStatus = dbChecks[AvailabilityCheckKey.ActiveStatus];
    const activeDateRange = dbChecks[AvailabilityCheckKey.ActiveDateRange];
    const productTypeAvailable =
      dbChecks[AvailabilityCheckKey.ProductTypeAvailabile];
    const blacklisted = dbChecks[AvailabilityCheckKey.Blacklisted];
    const whitelisted = dbChecks[AvailabilityCheckKey.Whitelisted];
    const availableProduct = !blacklisted || whitelisted;

    const checks = [
      {
        name: AvailabilityCheckName.ActiveStatus,
        result: activeStatus,
        detail: `Product is${activeStatus ? ' ' : ' not '}active.`,
      },
      {
        name: AvailabilityCheckName.ActiveDateRange,
        result: activeDateRange,
        detail: `Current date is${activeDateRange ? ' ' : ' not '}in range of product startDate/endDate.`,
      },
      {
        name: AvailabilityCheckName.ProductTypeAvailabilityRule,
        result: productTypeAvailable,
        detail: `ProductType is${productTypeAvailable ? ' ' : ' not '}available.`,
      },
      {
        name: AvailabilityCheckName.ProductAvailabilityRule,
        result: availableProduct,
        detail: this.buildProductAvailabilityDetail(whitelisted, blacklisted),
      },
    ];

    return { productId, available, checks };
  }

  private buildProductAvailabilityDetail(
    whitelisted: boolean,
    blacklisted: boolean,
  ): string {
    const reasons = [];

    if (blacklisted) {
      reasons.push(
        `At least one ${AvailabilityPolicy.Blacklist} rule exists for this product.`,
      );
    }
    if (whitelisted) {
      reasons.push(
        `At least one ${AvailabilityPolicy.Whitelist} rule exists for this product.`,
      );
    }
    if (blacklisted && whitelisted) {
      reasons.push(
        `Product is available due to ${AvailabilityPolicy.Whitelist} rule.`,
      );
    }
    if (!blacklisted && !whitelisted) {
      reasons.push(
        `Product is available by default due to this context using a ${AvailabilityPolicy.Whitelist} policy.`,
      );
    }

    return reasons.join(' ');
  }
}
