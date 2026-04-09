import { expect } from 'chai';
import { AvailabilityCheckName } from '../../../src/controllers/models/AvailabilityCheck';
import {
  AvailabilityCheckKey,
  AvailabilityConverter,
} from '../../../src/data/AvailabilityConverter';

describe('AvailabilityConverter', () => {
  let availabilityConverter: AvailabilityConverter;

  beforeEach(() => {
    availabilityConverter = new AvailabilityConverter();
  });

  it('should convert available with no blacklists / whitelists', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: true,
        availabilityChecks: {
          [AvailabilityCheckKey.ActiveStatus]: true,
          [AvailabilityCheckKey.ActiveDateRange]: true,
          [AvailabilityCheckKey.ProductTypeAvailabile]: true,
          [AvailabilityCheckKey.Blacklisted]: false,
          [AvailabilityCheckKey.Whitelisted]: false,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: true,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: true,
          detail: 'Product is active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: true,
          detail: 'Current date is in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: true,
          detail: 'ProductType is available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: true,
          detail:
            'Product is available by default due to this context using a whitelist policy.',
        },
      ],
    });
  });
  it('should convert available with whitelist policy', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: true,
        availabilityChecks: {
          [AvailabilityCheckKey.ActiveStatus]: true,
          [AvailabilityCheckKey.ActiveDateRange]: true,
          [AvailabilityCheckKey.ProductTypeAvailabile]: true,
          [AvailabilityCheckKey.Blacklisted]: false,
          [AvailabilityCheckKey.Whitelisted]: true,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: true,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: true,
          detail: 'Product is active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: true,
          detail: 'Current date is in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: true,
          detail: 'ProductType is available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: true,
          detail: 'At least one whitelist rule exists for this product.',
        },
      ],
    });
  });
  it('should convert unavailable because product inactive', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: false,
        availabilityChecks: {
          [AvailabilityCheckKey.ActiveStatus]: false,
          [AvailabilityCheckKey.ActiveDateRange]: true,
          [AvailabilityCheckKey.ProductTypeAvailabile]: true,
          [AvailabilityCheckKey.Blacklisted]: false,
          [AvailabilityCheckKey.Whitelisted]: true,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: false,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: false,
          detail: 'Product is not active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: true,
          detail: 'Current date is in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: true,
          detail: 'ProductType is available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: true,
          detail: 'At least one whitelist rule exists for this product.',
        },
      ],
    });
  });
  it('should convert unavailable because product date range inactive', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: false,
        availabilityChecks: {
          [AvailabilityCheckKey.ActiveStatus]: true,
          [AvailabilityCheckKey.ActiveDateRange]: false,
          [AvailabilityCheckKey.ProductTypeAvailabile]: true,
          [AvailabilityCheckKey.Blacklisted]: false,
          [AvailabilityCheckKey.Whitelisted]: true,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: false,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: true,
          detail: 'Product is active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: false,
          detail: 'Current date is not in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: true,
          detail: 'ProductType is available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: true,
          detail: 'At least one whitelist rule exists for this product.',
        },
      ],
    });
  });
  it('should convert unavailable because product type is not available', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: false,
        availabilityChecks: {
          [AvailabilityCheckKey.Policy]: 'whitelist',
          [AvailabilityCheckKey.ActiveStatus]: true,
          [AvailabilityCheckKey.ActiveDateRange]: true,
          [AvailabilityCheckKey.ProductTypeAvailabile]: false,
          [AvailabilityCheckKey.Blacklisted]: false,
          [AvailabilityCheckKey.Whitelisted]: true,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: false,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: true,
          detail: 'Product is active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: true,
          detail: 'Current date is in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: false,
          detail: 'ProductType is not available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: true,
          detail: 'At least one whitelist rule exists for this product.',
        },
      ],
    });
  });
  it('should convert unavailable because blacklisted and not whitelisted', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: false,
        availabilityChecks: {
          [AvailabilityCheckKey.ActiveStatus]: true,
          [AvailabilityCheckKey.ActiveDateRange]: true,
          [AvailabilityCheckKey.ProductTypeAvailabile]: true,
          [AvailabilityCheckKey.Blacklisted]: true,
          [AvailabilityCheckKey.Whitelisted]: false,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: false,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: true,
          detail: 'Product is active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: true,
          detail: 'Current date is in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: true,
          detail: 'ProductType is available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: false,
          detail: 'At least one blacklist rule exists for this product.',
        },
      ],
    });
  });
  it('should convert available because blacklisted but also whitelisted', () => {
    expect(
      availabilityConverter.convertFrom({
        productId: 1,
        available: false,
        availabilityChecks: {
          [AvailabilityCheckKey.ActiveStatus]: true,
          [AvailabilityCheckKey.ActiveDateRange]: true,
          [AvailabilityCheckKey.ProductTypeAvailabile]: true,
          [AvailabilityCheckKey.Blacklisted]: true,
          [AvailabilityCheckKey.Whitelisted]: true,
        },
      }),
    ).to.deep.equal({
      productId: 1,
      available: false,
      checks: [
        {
          name: AvailabilityCheckName.ActiveStatus,
          result: true,
          detail: 'Product is active.',
        },
        {
          name: AvailabilityCheckName.ActiveDateRange,
          result: true,
          detail: 'Current date is in range of product startDate/endDate.',
        },
        {
          name: AvailabilityCheckName.ProductTypeAvailabilityRule,
          result: true,
          detail: 'ProductType is available.',
        },
        {
          name: AvailabilityCheckName.ProductAvailabilityRule,
          result: true,
          detail:
            'At least one blacklist rule exists for this product. At least one whitelist rule exists for this product. Product is available due to whitelist rule.',
        },
      ],
    });
  });
});
