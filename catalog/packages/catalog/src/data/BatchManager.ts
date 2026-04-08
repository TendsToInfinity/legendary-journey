import { Logger } from '@securustablets/libraries.logging';
import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Inject, Singleton } from 'typescript-ioc';
import {
  BlockAction,
  BlockActionType,
} from '../controllers/models/BlockAction';
import { BlockReason } from '../controllers/models/BlockReason';
import { Product } from '../controllers/models/Product';
import { DpvCombination } from '../messaging/lie/DistinctProductValueLie';

export interface BatchTransform {
  // The table name being queried
  table: string;
  // The id column of the record being inserted/updated. This allows you to tie back to this record for FK relationships
  idColumn: string;
  // The id column name of the record being inserted/updated. It doesnt match with idColumn
  idColumnToPropertyName: string;
  // A function that takes a single entity and transforms it into a group-able insert statement
  // e.g. transform: (pd: PaymentData) => `($$${pd.col1}$$, ${pd.col2})`
  // It is recommended to use $$/$$ quoting for non-numeric data types, especially JSON: $$${value}$$
  // For numeric data do not quote it at all: ${number}
  // For null values use the string 'NULL': ${rp.billDay ? `$$${rp.billDay}$$` : 'NULL'}
  transform: any;
  // A function that takes an array of formatted values ready for insert
  // e.g. sql: (statements: any[]) => `INSERT INTO table (col1, col2) VALUES ${statements.join(',')} RETURNING table_id
  sql: any;
  // // Trigger names to disable during queries
  // disableTriggers: string[];
  // Batch size of inserts, default is 5,000
  batchSize?: number;
}

export const checkNull = (element?: any) => {
  return element ? element : 'NULL';
};

/**
 * Finds a string that is usable as a quote delimiter in postgres
 *    The $$ delimiter is allowed to have any string in between the $'s to make it more unique
 *    If just $$ is used as the quote and the string contains $$ it will short-circuit the quote and cause an error (or injection)
 *    string = 'a$$';
 *    Double $ quoting produces '$$a$$$$' which would be interpreted in sql as `column = "a"$$` causing a syntax error and not inserting the correct string
 *    The algorithm starts with the quote-string '$sep$' and if the string to be quoted doesn't contain that it's used:
 *      e.g. stringNull('a$$') = '$sep$a$$$sep$'
 *    If the string to be quoted contains the initial separator $sep$, then "sep" is duplicated until the quote is not found in the string:
 *      e.g. stringNull('$sep$') = '$sepsep$$sep$$sepsep$'
 *           stringNull('$sepsep$'
 * Documentation: https://www.postgresql.org/docs/8.1/sql-syntax.html#SQL-SYNTAX-CONSTANTS
 * @param element
 */
export const stringNull = (element?: string) => {
  const nil = checkNull(element);
  if (nil !== 'NULL') {
    let separator = `sep`;
    // if the target string has $sep$, increase number of "sep"s
    while (element.includes(`$${separator}$`)) {
      separator += 'sep';
    }
    return `$${separator}$${element}$${separator}$`;
  }
  return nil;
};

@Singleton
export class BatchManager {
  @Inject
  private log!: Logger;

  public static getBlockInsertTransform(): BatchTransform {
    return {
      table: 'block_reason',
      idColumn: 'block_reason_id',
      idColumnToPropertyName: 'blockReasonId',
      transform: (blockReason: BlockReason) => {
        return (
          `(${blockReason.productId}, ${checkNull(blockReason.blockedByProduct)}, ${checkNull(blockReason.termId)}, ${stringNull(blockReason.term)}, ` +
          `${checkNull(blockReason.blockActionId)}, ${stringNull(blockReason.manuallyBlockedReason)}, ${checkNull(blockReason.isActive)}, ${checkNull(blockReason.isManuallyBlocked)})`
        );
      },
      sql: (statements: string[]) => `
                INSERT INTO block_reason(product_id, blocked_by_product, term_id, term, block_action_id, manually_blocked_reason, is_active, is_manually_blocked)
                VALUES ${statements.join(',')}`,
    };
  }

  public static getBlockUpdateTransform(
    blockAction?: BlockAction,
  ): BatchTransform {
    // default to add if there is no blockAction
    const isActive = blockAction?.action !== BlockActionType.Remove;
    const actionId = blockAction?.blockActionId ?? 'NULL';
    return {
      table: 'block_reason',
      idColumn: 'block_reason_id',
      idColumnToPropertyName: 'blockReasonId',
      transform: (blockReason: BlockReason) => `${blockReason.blockReasonId}`,
      sql: (statements: string[]) => `
                WITH audit AS
                (UPDATE block_reason SET is_active = ${isActive}, block_action_id = ${actionId} WHERE block_reason_id IN (${statements.join(',')}) RETURNING *)
                INSERT INTO audit_history(action, entity_type, entity_id, context, document)
                SELECT 'UPDATE','block_reason', audit.block_reason_id, $$${JSON.stringify({ reason: 'Background block process' })}$$, row_to_json(audit)
                FROM audit`,
    };
  }

  public static getProductTransform(blockAction: BlockAction): BatchTransform {
    // default to add if there is no blockAction
    const productUpdate: any = {
      isBlocked: blockAction.action !== BlockActionType.Remove,
    };
    return {
      table: 'product',
      idColumn: 'product_id',
      idColumnToPropertyName: 'productId',
      transform: (product: Product) => `${product.productId}`,
      sql: (statements: string[]) => `
                WITH audit AS
                (UPDATE product SET document = document || $$${JSON.stringify(productUpdate)}$$ WHERE product_id IN (${statements.join(',')}) RETURNING *)
                INSERT INTO audit_history(action, entity_type, entity_id, context, document)
                SELECT 'UPDATE','product', audit.product_id, $$${JSON.stringify({ reason: 'Background block process' })}$$, row_to_json(audit)
                FROM audit`,
    };
  }

  public static getProductUpdateTransform(): BatchTransform {
    const rowUpdateLimit = 15000; // number of products to be updated in one transaction
    return {
      table: 'product',
      idColumn: 'entity_id',
      idColumnToPropertyName: 'entityId',
      transform: (dpvCombination: DpvCombination) => `
            WITH audit AS
            (
                WITH cte AS (
                    SELECT product_id
                    FROM product
                    WHERE LOWER(document->${this.getClauseString(dpvCombination.fieldSourcePath)}) = ('${JSON.stringify(dpvCombination.sourceValue)}'::JSONB)::TEXT
                    AND NOT LOWER(document->${this.getClauseString(dpvCombination.fieldPath)}) = ('${JSON.stringify(dpvCombination.destinationValue).toLowerCase()}'::JSONB)::TEXT
                    AND document->>'productTypeGroupId'='${dpvCombination.productTypeGroupId}'
                    LIMIT ${rowUpdateLimit})
                UPDATE product p
                SET document = jsonb_set(document, '{${this.getSplittedPathString(dpvCombination.fieldPath)}}', '${JSON.stringify(dpvCombination.destinationValue)}')
                FROM cte
                WHERE p.product_id = cte.product_id
                RETURNING p.*)
            INSERT INTO audit_history(action, entity_type, entity_id, context, document)
            SELECT 'UPDATE','product', audit.product_id, '${JSON.stringify({ reason: 'DPV process' })}', row_to_json(audit)
            FROM audit RETURNING entity_id`,
      sql: (statement: string) => statement,
    };
  }

  /**
   * Execute a series of batch queries returning the IDs from the affected rows
   * @param entities
   * @param transform
   */
  public async runBatch(
    entities: any[],
    transform: BatchTransform,
  ): Promise<any[]> {
    const pg = Postgres.getInstance();
    let batchCount = 0;
    const batchSize = transform.batchSize || 5000;
    const allIds: any[] = [];
    while (entities.slice(batchCount, batchCount + batchSize).length > 0) {
      this.log.info(
        `Writing batch ${batchCount} of ${entities.length} entities `,
      );
      await pg.write('BEGIN');
      const batch = entities.slice(batchCount, batchCount + batchSize);
      const data = _.map(batch, (entity) => transform.transform(entity));
      try {
        const ids = await pg.write(transform.sql(data)).then((i) => {
          return _.get(i, 'rows');
        });
        allIds.push(..._.map(ids, transform.idColumnToPropertyName));
      } catch (err) {
        this.log.error(err);
      }
      await pg.write('COMMIT');
      await Bluebird.delay(500);
      batchCount += batchSize;
    }
    return allIds;
  }

  /**
   * Execute a series of paginated batch queries returning the IDs from the affected rows
   * @param entities
   * @param transform
   */
  public async runPaginatedUpdateBatch(
    entities: any[],
    transform: BatchTransform,
  ): Promise<number[]> {
    const pg = Postgres.getInstance();
    let batchCount = 0;
    const batchSize = transform.batchSize || 5000;
    let updatedIds = [];
    while (entities.slice(batchCount, batchCount + batchSize).length > 0) {
      this.log.info(
        `Writing paginated update ${batchCount} of ${entities.length} entities`,
      );
      const batch = entities.slice(batchCount, batchCount + batchSize);
      const data = _.map(batch, (entity) => transform.transform(entity));
      // for each data, we run an update until all the data has been processed
      let dataIndex = 0;
      do {
        let pageIndex = 0;
        let response: any[] = [];
        const dataSqlPage = transform.sql(data[dataIndex]);
        // for each data we run the same paginated update in the transaction
        do {
          await pg.write('BEGIN');
          response = [];
          try {
            this.log.info(
              `Trying to write the paginated update for a data with index ${dataIndex} and page ${pageIndex}`,
            );
            response = await pg.write(dataSqlPage).then((i) => {
              return _.get(i, 'rows');
            });
            updatedIds = updatedIds.concat(response);
          } catch (err) {
            this.log.error(err);
            response = []; // skip the query
          }
          await pg.write('COMMIT');
          pageIndex++;
        } while (response.length > 0);
        dataIndex++;
      } while (dataIndex < data.length);
      batchCount += batchSize;
    }
    return _.map(updatedIds, transform.idColumnToPropertyName);
  }

  /**
   * Expects already batched data. Run multiple updates in 1 transaction
   * !!!!!!!!!!!!!! This method expects batched entities, ai size of the batch should BE NO MORE THAN 5000 elements !!!!!!!!!!!!
   * @param updates { entities: any[], transform: BatchTransform}[]
   */
  public async runMultipleUpdates(
    updates: Array<{ entities: any[]; transform: BatchTransform }>,
  ) {
    const pg = Postgres.getInstance();
    await pg.write('BEGIN');
    for (const update of updates) {
      const data = _.map(update.entities, (entity) =>
        update.transform.transform(entity),
      );
      await pg.write(update.transform.sql(data));
    }
    await pg.write('COMMIT');
    await Bluebird.delay(500);
  }

  /**
   * dynamically generates a clause string with a path to the dpv field
   */
  public static getClauseString(path: string): string {
    const lastDotIndex = path.lastIndexOf('.');
    path = `${path.substring(0, lastDotIndex)}'->>'${path.substring(lastDotIndex + 1)}`;
    return `'${path.split('.').join(`'->'`)}'`; // the String.replace replaces only one occurence
  }

  /**
   * dynamically generates a splitted string with a destination path array for the field for update
   */
  public static getSplittedPathString(path: string): string {
    return `"${path.split('.').join('","')}"`; // the String.replace replaces only one occurence
  }
}
