import { _ } from '@securustablets/libraries.utils';
import {
  CustomProperty,
  ErrorDetail,
  Schema,
  Validator,
  ValidatorResult,
} from 'jsonschema';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Singleton } from 'typescript-ioc';
import { Product, ProductStatus } from '../controllers/models/Product';

@Singleton
export class ProductValidator {
  public validate(product: Product, schema: Schema): void {
    // We pass in model || null to the validator because if we pass in undefined, the validator just completely
    // skips all validation and reports no errors... :/
    const result = this.buildValidator(product).validate(
      product || null,
      schema,
    );

    if (result.errors.length > 0) {
      throw Exception.InvalidData({
        message: 'Product is invalid',
        errors: _.map(result.errors, (i) => _.pick(i, 'property', 'message')),
      });
    }
  }

  private buildValidator(product: Product): Validator {
    const validator = new Validator();
    validator.attributes.requiredIfActive =
      ProductValidator.requiredIfActive(product);
    return validator;
  }

  private static requiredIfActive(product: Product): CustomProperty {
    return (instance, schema, options, ctx) => {
      const validatorResult = new ValidatorResult(
        instance,
        schema,
        options,
        ctx,
      );
      if (product.status === ProductStatus.Active) {
        if (_.isUndefined(instance)) {
          validatorResult.addError({
            name: 'requiredIfActive',
            message: `required when product status is '${ProductStatus.Active}'`,
          } as ErrorDetail);
        }
      }

      return validatorResult;
    };
  }
}
