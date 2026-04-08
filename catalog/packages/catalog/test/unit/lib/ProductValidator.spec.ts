import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import {
  Product,
  ProductStatus,
} from '../../../src/controllers/models/Product';
import { ProductValidator } from '../../../src/lib/ProductValidator';

describe('ProductValidator', () => {
  let productValidator: ProductValidator;

  beforeEach(() => {
    productValidator = new ProductValidator();
  });

  function schema() {
    return {
      type: 'object',
      properties: {
        status: {
          enum: ['Active', 'Deleted', 'PendingReview', 'Reingest', 'Inactive'],
          type: 'string',
        },
        meta: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: {
              type: 'string',
              requiredIfActive: true,
              minLength: 1,
            },
            cast: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'array', items: { type: 'string' } },
                },
                required: ['name', 'role'],
              },
            },
          },
          required: ['name'],
        },
      },
      required: ['status', 'meta'],
      $schema: 'http://json-schema.org/draft-07/schema#',
    };
  }

  describe('validate', () => {
    it('should succeed for valid products', () => {
      const product = {
        status: ProductStatus.PendingReview,
        meta: {
          name: 'Foo',
          description: 'A product',
        },
      } as Product;

      const error = _.attempt(() =>
        productValidator.validate(product, schema()),
      );
      expect(error).to.equal(undefined);
    });

    it('should fail for invalid products', () => {
      const product = {
        status: ProductStatus.PendingReview,
        meta: {},
      } as Product;

      const error = _.attempt(() =>
        productValidator.validate(product, schema()),
      );
      expect(_.get(error, 'message')).to.include('Product is invalid');
      expect(_.get(error, 'errors')).to.deep.equal([
        {
          property: 'instance.meta',
          message: 'requires property "name"',
        },
      ]);
    });

    it('should fail for product=undefined', () => {
      const error = _.attempt(() =>
        productValidator.validate(undefined, schema()),
      );
      expect(_.get(error, 'errors')).to.deep.equal([
        {
          property: 'instance',
          message: 'is not of a type(s) object',
        },
      ]);
    });

    it('should not enforce requiredIfActive for inactive products', () => {
      const product = {
        status: ProductStatus.PendingReview,
        meta: {
          name: 'Foo',
        },
      } as Product;

      const error = _.attempt(() =>
        productValidator.validate(product, schema()),
      );
      expect(error).to.equal(undefined);
    });

    it('should enforce requiredIfActive for active products', () => {
      const product = {
        status: ProductStatus.Active,
        meta: {
          name: 'Foo',
        },
      } as Product;

      const error = _.attempt(() =>
        productValidator.validate(product, schema()),
      );
      expect(_.get(error, 'errors')).to.deep.equal([
        {
          property: 'instance.meta.description',
          message: `required when product status is '${ProductStatus.Active}'`,
        },
      ]);
    });

    it('should enforce requiredIfActive+minLength for active products', () => {
      const product = {
        status: ProductStatus.Active,
        meta: {
          name: 'Foo',
          description: '',
        },
      } as Product;

      const error = _.attempt(() =>
        productValidator.validate(product, schema()),
      );
      expect(_.get(error, 'errors')).to.deep.equal([
        {
          property: 'instance.meta.description',
          message: 'does not meet minimum length of 1',
        },
      ]);
    });
  });
});
