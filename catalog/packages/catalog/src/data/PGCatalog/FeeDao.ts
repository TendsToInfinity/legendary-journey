import { pga } from '@securustablets/libraries.audit-history';
import {
  CacheContainer,
  Csi,
  MethodCache,
} from '@securustablets/libraries.cache';
import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject } from 'typescript-ioc';
import { Fee } from '../../controllers/models/Fee';
import { AuditContext } from '../../lib/models/AuditContext';
import { AppConfig } from '../../utils/AppConfig';
import { ClauseConverter } from '../ClauseConverter';
import { ContextHelper } from './ContextHelper';
import { ProductTypeDao } from './ProductTypeDao';

@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlMedium,
})
export class FeeDao extends ContextHelper<Fee> {
  @Inject
  private clauseConverter!: ClauseConverter;

  @Inject
  private productTypeDao: ProductTypeDao;

  protected pga = pga<AuditContext, Fee>(this);

  public find = this.pga.find();
  public findOneOrFail = this.pga.findOneOrFail();
  public create = this.pga.create();
  public update = this.pga.update();
  public delete = this.pga.delete();
  public findByContextWithJsonClauses =
    this.findByContextWithJsonClauses.bind(this);
  public findByQueryString = this.pga.findByQueryString();

  public async convertFrom(row: any): Promise<Fee> {
    const { jsonSchema } = await this.productTypeDao.findOneOrFail(
      row.productTypeId,
    );
    return {
      ..._.omit(row as Fee, 'siteId', 'customerId', 'amount'),
      ...(row.siteId && { siteId: row.siteId }),
      ...(row.customerId && { customerId: row.customerId }),
      amount: parseFloat(row.amount),
      clauses: this.clauseConverter.convertFrom(row.clauses, jsonSchema),
    };
  }

  public async convertTo(model: Fee): Promise<any> {
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

  @MethodCache(Csi.Tier3)
  public async aggregateClauses(feeIds: number[]): Promise<object[]> {
    const result = await this.query(
      `SELECT product_type_id, clauses FROM fee WHERE fee_id = ANY($1)`,
      [feeIds],
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
}
