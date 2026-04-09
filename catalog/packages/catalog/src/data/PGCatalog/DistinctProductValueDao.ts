import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { DistinctProductValue } from '../../controllers/models/DistinctProductValue';
import { AuditContext } from '../../lib/models/AuditContext';
export class DistinctProductValueDao extends PostgresDao<DistinctProductValue> {
  protected pga = pga<AuditContext, DistinctProductValue>(this);

  public createAndRetrieve = pga(this).createAndRetrieve();
  public delete = pga(this).delete();
  public find = pga(this).find();
  public findByQueryString = pga(this).findByQueryString();
  public findOneOrFail = pga(this).findOneOrFail();
  public findOne = pga(this).findOne();
  public updateAndRetrieve = pga(this).updateAndRetrieve();

  public async findByPathAndGroupAndSourceValue(
    fieldPath: string,
    productTypeGroupId: string,
    sourceValueName: string,
  ): Promise<DistinctProductValue[]> {
    return this.find({
      by: {
        fieldPath: fieldPath,
        productTypeGroupId: productTypeGroupId,
        sourceValueName: sourceValueName,
      },
    });
  }

  public async getDistinctDisplayForValueAndProductType(
    fieldPath: string,
    productTypeGroupId: string,
  ): Promise<DistinctProductValue[]> {
    // filedName should be a normal string but not appended with a single quote in the query, so it should not be passed as an parameter but should be sent as an interpolated string.
    const results = await this.query(
      `SELECT DISTINCT display_name FROM distinct_product_value WHERE field_path = $1 AND product_type_group_id = $2`,
      [fieldPath, productTypeGroupId],
    );
    return _.map(results.rows, 'displayName');
  }
}
