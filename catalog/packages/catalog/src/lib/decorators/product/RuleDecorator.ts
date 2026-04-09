import { _ } from '@securustablets/libraries.utils';
import { Inject, Singleton } from 'typescript-ioc';
import { PricedProduct } from '../../../controllers/models/Product';
import { RuleType } from '../../../controllers/models/Rule';
import { Context } from '../../../controllers/models/Search';
import { RuleDao } from '../../../data/PGCatalog/RuleDao';
import { Decorator } from '../../ProductDecoratorManager';

@Singleton
export class RuleDecorator {
  @Inject
  private ruleDao!: RuleDao;

  // When adding or changing decorator fields also update getDecoratorFields to reflect these new values
  public forBoolean(ruleType: RuleType): Decorator {
    return async (
      products: PricedProduct[],
      context: Context,
    ): Promise<void> => {
      const rules = await this.ruleDao.findSetByContext(context, ruleType);

      // get the action name and create white/blacklists actions
      const actionName = this.booleanActionName(
        RuleDao.RULE_TYPE_META[ruleType],
      );
      const whitelistAction = { action: { [actionName]: true } };
      const blacklistAction = { action: { [actionName]: false } };

      const whitelistClauses = await this.ruleDao.aggregateClauses(
        _.chain(rules).filter(whitelistAction).map('ruleId').value(),
      );
      const blacklistClauses = await this.ruleDao.aggregateClauses(
        _.chain(rules).filter(blacklistAction).map('ruleId').value(),
      );

      _.forEach(products, (product) => {
        _.merge(product, _.get(RuleDao.RULE_TYPE_META[ruleType], 'default'));

        if (this.isMatch(product, whitelistClauses)) {
          _.merge(product, whitelistAction.action);
        }

        if (this.isMatch(product, blacklistClauses)) {
          _.merge(product, blacklistAction.action);
        }
      });
    };
  }

  private booleanActionName(rule: object): string {
    return _.first(_.keys(_.get(rule, 'default')));
  }

  private isMatch(
    product: PricedProduct,
    clauses: Array<Partial<PricedProduct>>,
  ): boolean {
    return !!_.find(clauses, (clause) => _.isMatch(product, clause));
  }

  public getDecoratorFields(): string[] {
    return [
      this.booleanActionName(RuleDao.RULE_TYPE_META[RuleType.ProductCache]),
      this.booleanActionName(
        RuleDao.RULE_TYPE_META[RuleType.ProductAvailability],
      ),
    ];
  }
}
