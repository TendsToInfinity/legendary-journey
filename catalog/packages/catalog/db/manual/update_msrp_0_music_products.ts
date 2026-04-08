/* tslint:disable:no-console */
import { Postgres, PostgresDao } from '@securustablets/libraries.postgres';
import * as Bluebird from 'bluebird';
import { Container } from 'typescript-ioc';
import { CatalogService } from '../../src/CatalogService';
import { AuditContext } from '../../src/lib/models/AuditContext';
import { Product } from '../reference/Product';

CatalogService.bindAll();

export class UpdateMusicProductsWithZeroMsrp extends PostgresDao<Product> {
  public async run(): Promise<void> {
    let count = 0;
    let processed = 0;
    const securityContext = {
      reason: 'update availableForPurchase to false if purchase is 0',
    } as AuditContext;
    const query = `
        WITH audit AS
            (UPDATE product SET document = jsonb_set(document, '{source, availableForPurchase}', 'false')
                WHERE product_id IN (SELECT product_id FROM product
                    WHERE document->>'productTypeId' IN ('album', 'track')
                    AND (document->'meta'->'basePrice'->>'purchase')::DECIMAL <= 0
                    AND (document->'source'->>'availableForPurchase')='true'
                    FOR UPDATE SKIP LOCKED
                    LIMIT 500)
                RETURNING product_id, document
            )
            INSERT INTO audit_history(action, entity_type, entity_id, context, document)
            SELECT 'UPDATE','product', audit.product_id, $1, audit.document from audit
            RETURNING entity_id;
    `;
    do {
      const results = await this.write(query, [securityContext]);
      count = results.rowCount;
      processed += count;
      console.log(`processed - ${processed}`);
      await Bluebird.delay(1000);
      console.log(
        `awaited for one second, next batch update will be invoked now`,
      );
    } while (count > 0);
  }
}

const updateMusicProductsWithZeroMsrp = new UpdateMusicProductsWithZeroMsrp();
updateMusicProductsWithZeroMsrp.run().then(() => {
  Container.get(Postgres).end();
});
