import { pga } from '@securustablets/libraries.audit-history';
import {
  CacheContainer,
  Csi,
  MethodCache,
} from '@securustablets/libraries.cache';
import {
  FindOneOptions,
  FindOptions,
  PostgresDao,
} from '@securustablets/libraries.postgres';
import { Lazy, _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container } from 'typescript-ioc';
import { ProductTypeAvailability } from '../../controllers/models/ProductTypeAvailability';
import { Rule, RuleType } from '../../controllers/models/Rule';
import { Context } from '../../controllers/models/Search';
import { AuditContext } from '../../lib/models/AuditContext';
import { ProductType } from '../../lib/models/ProductType';
import { AppConfig } from '../../utils/AppConfig';
import { RuleDao } from './RuleDao';

@CacheContainer(Csi.Tier1, {
  secondsToLive: Container.get(AppConfig).cache.ttlShort,
})
@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlMedium,
})
export class ProductTypeDao extends PostgresDao<ProductType> {
  // Circular dependency
  @Lazy
  private get ruleDao(): RuleDao {
    return Container.get(RuleDao);
  }

  protected pga = pga<AuditContext, ProductType>(this);

  private _findOneOrFail = this.pga.findOneOrFail<string>();
  public update = this.pga.update<string>();
  private _find = this.pga.find();

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findAll() {
    const productTypes = await this._find();

    return productTypes;
  }

  public async find(
    options: FindOptions<ProductType, number> & { total: true },
  ): Promise<[ProductType[], number]>;
  public async find(
    options?: FindOptions<ProductType, number>,
  ): Promise<ProductType[]>;
  public async find(
    options?: FindOptions<ProductType, number>,
  ): Promise<ProductType[] | [ProductType[], number]> {
    if (_.isEmpty(options)) {
      return this.findAll();
    } else {
      return this._find(options);
    }
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findById(productTypeId: string): Promise<ProductType> {
    return _.find(
      await this.findAll(),
      (pt) => pt.productTypeId === productTypeId,
    );
  }

  public async findByIdOrFail(productTypeId: string): Promise<ProductType> {
    const productType = await this.findById(productTypeId);

    if (_.isUndefined(productType)) {
      throw Exception.NotFound({
        errors: `No ProductType found matching { productTypeId: '${productTypeId}' }`,
      }); // message is for backwards compatibility
    }

    return productType;
  }

  public async findOneOrFail(
    options: FindOneOptions<ProductType, string>,
  ): Promise<ProductType> {
    if (_.isString(options)) {
      return this.findByIdOrFail(options);
    }

    return this._findOneOrFail(options);
  }

  @MethodCache(Csi.Tier3)
  public async findByContext(context?: Context): Promise<ProductType[]> {
    const productTypes = await this.findAll();
    const availabilities = await this.buildAvailabilities(
      productTypes,
      context,
    );
    return _.zipWith(
      productTypes,
      availabilities,
      (productType, { available }) => ({ ...productType, available }),
    );
  }

  public async findOneOrFailByContext(
    productTypeId: string,
    context?: Context,
  ): Promise<ProductType> {
    const productType = await this.findByIdOrFail(productTypeId);
    const { available } = await this.buildAvailability(productType, context);
    return { ...productType, available };
  }

  public async findAvailabilityOrFail(
    productTypeId: string,
    context?: Context,
  ): Promise<ProductTypeAvailability> {
    return this.buildAvailability(
      await this.findByIdOrFail(productTypeId),
      context,
    );
  }

  private async buildAvailability(
    productType: ProductType,
    context?: Context,
  ): Promise<ProductTypeAvailability> {
    return _.first(await this.buildAvailabilities([productType], context));
  }

  private async buildAvailabilities(
    productTypes: ProductType[],
    context?: Context,
  ): Promise<ProductTypeAvailability[]> {
    const rules = await this.ruleDao.findSetByContext(
      context,
      RuleType.ProductTypeAvailability,
    );

    return Bluebird.map(productTypes, (productType) => {
      // Rules sorted so that context-specific rules come first.
      const productTypeRules = _.chain(rules)
        .filter({ productTypeId: productType.productTypeId })
        .sortBy('siteId')
        .value();

      // We use the first rule in the list as the source of truth for availability.
      // If this rule's context does not strictly equal the context we've been given, that means it is inherited and it's also technically the parent rule.
      // Otherwise, the parent rule would just be the next rule in the list, or undefined if no such rule exists.
      const rule = productTypeRules[0];
      const inherited = this.isRuleInherited(rule, context);
      const parentRule = inherited ? rule : productTypeRules[1];

      // Determine
      //   1. Effective availability for the productType in this context.
      //   2. What the availability for the productType would be if we hypothetically deleted the existing context-specific rule and defaulted to inheritance.
      // If we don't actually have a context-specific rule (meaning rule === parentRule), or we have no rules at all, these two values will be identical
      const available = _.get(rule, 'action.available', productType.available);
      const parentAvailable = _.get(
        parentRule,
        'action.available',
        productType.available,
      );

      return {
        available,
        inherited,
        // We only show a ruleId here if it's a context-specific rule. We never show a parent ruleId here.
        ruleId: inherited ? undefined : _.get(rule, 'ruleId'),
        // It does not make sense for us to return parent availability if we came in with a global (empty) context.
        parent: this.isGlobalContext(context)
          ? undefined
          : { available: parentAvailable },
      };
    });
  }

  private isGlobalContext(context: Context) {
    return _.isEmpty(_.pickBy(context, (value) => !_.isUndefined(value)));
  }

  private isRuleInherited(rule: Rule, context: Context) {
    return !_.isEqual(
      {
        customerId: _.get(context, 'customerId'),
        siteId: _.get(context, 'siteId'),
      },
      { customerId: _.get(rule, 'customerId'), siteId: _.get(rule, 'siteId') },
    );
  }
}
