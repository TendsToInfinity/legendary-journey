import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import * as moment from 'moment';
import { Product } from '../controllers/models/Product';
import { AuditContext } from '../lib/models/AuditContext';

export class ParentProductDao extends PostgresDao<Product> {
  protected pga = pga<AuditContext, Product>(this);

  public findOneOrFail = this.pga.findOneOrFail();
  public find = this.pga.find();
  public push = this.pga.push();

  protected get model(): string {
    return 'Product';
  }

  protected get noSql(): boolean {
    return true;
  }

  /**
   * Updates the source.availableForSubscription on a product, avoiding version safety to allow multiple concurrent activities
   * @param parentProductId
   * @param availableForSubscription
   * @param context
   */
  public async updateAvailableForSubscription(
    parentProductId: number,
    availableForSubscription: boolean,
    context: AuditContext,
  ): Promise<Product> {
    const sql = `WITH audit AS
            (UPDATE product SET document = jsonb_set(document, '{source,availableForSubscription}', '${availableForSubscription}', true) WHERE product_id = ${parentProductId} RETURNING *)
            INSERT INTO audit_history(action, entity_type, entity_id, context, document)
            SELECT 'UPDATE','product', audit.product_id, $$${JSON.stringify(context)}$$, row_to_json(audit)
            FROM audit RETURNING document`;
    return this.convertFrom((await this.write(sql)).rows[0].document);
  }

  public convertFrom(row: any): Product {
    return {
      ...row.document,
      productId: row.product_id,
      cdate: moment(row.cdate).utc().toISOString(),
      udate: moment(row.udate).utc().toISOString(),
      version: row.version,
      available: row.available,
    };
  }
}
