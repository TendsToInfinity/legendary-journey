import { InterfaceValidator } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import * as util from 'util';
import { Rule, RuleType } from '../controllers/models/Rule';
import { RuleDao } from '../data/PGCatalog/RuleDao';

@Singleton
export class RuleValidator {
  @Inject
  private ruleDao!: RuleDao;

  @Inject
  private interfaceValidator!: InterfaceValidator;

  public async validate(rule: Rule): Promise<Rule> {
    const errors = await this.validateType(rule);

    if (errors.length > 0) {
      throw Exception.InvalidData({
        message: 'Rule is invalid',
        errors: _.map(errors, (i) => _.pick(i, 'property', 'message')),
      });
    }

    if (!rule.customerId && rule.siteId) {
      throw Exception.InvalidData({
        message: 'Rule is invalid, siteId defined without customerId',
      });
    }

    if (rule.type === RuleType.ProductTypeAvailability) {
      const by = {
        // We need to explicitly search for null siteId if it's not provided
        // so that customerId rules don't end up being duplicates of customerId+siteId rules.
        siteId: null,
        ..._.pick(rule, 'customerId', 'siteId', 'productTypeId', 'type'),
      };

      if (await this.ruleDao.exists({ by })) {
        throw Exception.Conflict({
          errors: `Cannot create duplicate rule of type='${RuleType.ProductTypeAvailability}' for ${util.inspect(_.omit(by, 'type'))}`,
        });
      }
    }

    return rule;
  }

  private async validateType(rule: Rule) {
    // product_availability -> ProductAvailabilityRule
    const interfaceName = `${_.upperFirst(_.camelCase(rule.type))}Rule`;
    const result = await this.interfaceValidator.validateModel(
      rule,
      interfaceName,
    );
    return result === true ? [] : result;
  }
}
