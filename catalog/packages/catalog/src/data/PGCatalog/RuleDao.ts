import { pga } from '@securustablets/libraries.audit-history';
import {
  CacheContainer,
  Csi,
  MethodCache,
} from '@securustablets/libraries.cache';
import { Lazy, _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject } from 'typescript-ioc';
import { Rule, RuleSets, RuleType } from '../../controllers/models/Rule';
import { Context } from '../../controllers/models/Search';
import { AuditContext } from '../../lib/models/AuditContext';
import { AppConfig } from '../../utils/AppConfig';
import { ClauseConverter } from '../ClauseConverter';
import { ContextHelper } from './ContextHelper';
import { ProductTypeDao } from './ProductTypeDao';

@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlMedium,
})
export class RuleDao extends ContextHelper<Rule> {
  @Inject
  private clauseConverter!: ClauseConverter;

  // Circular dependency
  @Lazy
  private get productTypeDao(): ProductTypeDao {
    return Container.get(ProductTypeDao);
  }

  protected pga = pga<AuditContext, Rule>(this);

  public findOneOrFail = this.pga.findOneOrFail();
  public find = this.pga.find();
  public exists = this.pga.exists();
  public create = this.pga.create();
  public update = this.pga.update();
  public delete = this.pga.delete();
  public findByQueryString = this.pga.findByQueryString();
  public findSetByContext = this.findByContext.bind(this);
  public findByContextWithJsonClauses =
    this.findByContextWithJsonClauses.bind(this);

  public static readonly RULE_TYPE_META = {
    [RuleType.ProductAvailability]: { default: { available: true } },
    [RuleType.ProductPrice]: {},
    [RuleType.ProductTypeAvailability]: {},
    [RuleType.ProductCache]: { default: { cache: false } },
  };

  public async findSetsByContext(
    context: Context | undefined,
    types?: RuleType[],
  ): Promise<RuleSets> {
    return _.fromPairs(
      await Bluebird.map(
        _.defaultTo(types, _.values(RuleType) as RuleType[]),
        async (type) => [type, await this.findSetByContext(context, type)],
      ),
    );
  }

  @MethodCache(Csi.Tier3)
  public async aggregateClauses(ruleIds: number[]): Promise<object[]> {
    const result = await this.query(
      `SELECT product_type_id, clauses FROM rule WHERE rule_id = ANY($1)`,
      [ruleIds],
    );

    return _.flatMap(result.rows, (row) =>
      _.isEmpty(row.clauses)
        ? { productTypeId: row.productTypeId }
        : _.map(row.clauses, (clause) => ({
            ...clause,
            productTypeId: row.productTypeId,
          })),
    );
  }

  public async convertFrom(row: any): Promise<Rule> {
    const { jsonSchema } = await this.productTypeDao.findOneOrFail(
      row.productTypeId,
    );
    return {
      ..._.omit(row as Rule, 'siteId', 'customerId', 'clauses', 'productId'),
      ...(row.siteId && { siteId: row.siteId }),
      ...(row.customerId && { customerId: row.customerId }),
      ...(row.productId && { productId: row.productId }),
      clauses: this.clauseConverter.convertFrom(row.clauses, jsonSchema),
    };
  }

  public async convertTo(model: Rule): Promise<any> {
    if (model.clauses && !model.productTypeId) {
      throw Exception.InternalError(
        'Cannot convert clauses without a productTypeId.',
      );
    }
    const { jsonSchema } =
      !!model.clauses &&
      (await this.productTypeDao.findOneOrFail(model.productTypeId));
    return {
      ...super.convertTo(model),
      ...(model.clauses && {
        clauses: this.clauseConverter.convertTo(model.clauses, jsonSchema),
      }),
    };
  }
}
