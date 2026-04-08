import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Product } from '../../../db/reference/Product';
import {
  BlockActionBy,
  BlockActionType,
} from '../../../src/controllers/models/BlockAction';
import { BlockReason } from '../../../src/controllers/models/BlockReason';
import {
  BatchManager,
  BatchTransform,
  checkNull,
  stringNull,
} from '../../../src/data/BatchManager';
import { DpvCombination } from '../../../src/messaging/lie/DistinctProductValueLie';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BatchManager - Unit', () => {
  const sandbox = sinon.createSandbox();
  let manager: BatchManager;
  let mockLogger: sinon.SinonMock;
  let mockPg: sinon.SinonMock;
  beforeEach(() => {
    manager = new BatchManager();
    mockLogger = sandbox.mock((manager as any).log);
    const stubPg = { write: () => ({}) };
    sandbox.stub(Postgres, 'getInstance').returns(stubPg);
    mockPg = sandbox.mock(stubPg);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('blockProductTransform', () => {
    it('should create a sql request to block products', () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();

      const entities = [product1, product2];
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
      });
      const data = _.map(entities, (entity) =>
        BatchManager.getProductTransform(blockAction).transform(entity),
      );
      const result = BatchManager.getProductTransform(blockAction).sql(data);

      expect(result).to.have.string(
        `product_id IN (${product1.productId},${product2.productId})`,
      );
      expect(result).to.have.string('document || $${"isBlocked":true}$$');
    });
    it('should create a sql request to unblock products', () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();

      const entities = [product1, product2];
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Terms,
        action: BlockActionType.Remove,
      });
      const data = _.map(entities, (entity) =>
        BatchManager.getProductTransform(blockAction).transform(entity),
      );
      const result = BatchManager.getProductTransform(blockAction).sql(data);

      expect(result).to.have.string(
        `product_id IN (${product1.productId},${product2.productId})`,
      );
      expect(result).to.have.string('document || $${"isBlocked":false}$$');
    });
  });

  describe('blockUpdateTransform', () => {
    it('should create a sql request to update blockReasons to active', () => {
      const blockReason1 = ModelFactory.blockReason();
      const blockReason2 = ModelFactory.blockReason();

      const entities = [blockReason1, blockReason2];
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        blockActionId: 42,
      });
      const data = _.map(entities, (entity) =>
        BatchManager.getBlockUpdateTransform(blockAction).transform(entity),
      );
      const result =
        BatchManager.getBlockUpdateTransform(blockAction).sql(data);

      expect(result).to.have.string(
        `block_reason_id IN (${blockReason1.blockReasonId},${blockReason2.blockReasonId})`,
      );
      expect(result).to.have.string(
        `is_active = true, block_action_id = ${blockAction.blockActionId}`,
      );
    });
    it('should create a sql request to update blockReasons to inactive', () => {
      const blockReason1 = ModelFactory.blockReason();
      const blockReason2 = ModelFactory.blockReason();

      const entities = [blockReason1, blockReason2];
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Terms,
        action: BlockActionType.Remove,
        blockActionId: 42,
      });
      const data = _.map(entities, (entity) =>
        BatchManager.getBlockUpdateTransform(blockAction).transform(entity),
      );
      const result =
        BatchManager.getBlockUpdateTransform(blockAction).sql(data);

      expect(result).to.have.string(
        `block_reason_id IN (${blockReason1.blockReasonId},${blockReason2.blockReasonId})`,
      );
      expect(result).to.have.string(
        `is_active = false, block_action_id = ${blockAction.blockActionId}`,
      );
    });
    it('should create a sql request to update blockReasons to active if no blockAction is sent', () => {
      const blockReason1 = ModelFactory.blockReason();
      const blockReason2 = ModelFactory.blockReason();

      const entities = [blockReason1, blockReason2];
      const data = _.map(entities, (entity) =>
        BatchManager.getBlockUpdateTransform().transform(entity),
      );
      const result = BatchManager.getBlockUpdateTransform().sql(data);

      expect(result).to.have.string(
        `block_reason_id IN (${blockReason1.blockReasonId},${blockReason2.blockReasonId})`,
      );
      expect(result).to.have.string(`is_active = true, block_action_id = NULL`);
    });
  });

  describe('blockReasonTransform', () => {
    it('should create a sql request to insert block reasons', () => {
      const blockReason = ModelFactory.blockReason();
      const entities = [blockReason];
      const data = _.map(entities, (entity) =>
        BatchManager.getBlockInsertTransform().transform(entity),
      );
      const result = BatchManager.getBlockInsertTransform().sql(data);

      const value =
        `(${blockReason.productId}, ${checkNull(blockReason.blockedByProduct)}, ${checkNull(blockReason.termId)}, ${stringNull(blockReason.term)}, ` +
        `${checkNull(blockReason.blockActionId)}, ${stringNull(blockReason.manuallyBlockedReason)}, ${checkNull(blockReason.isActive)}, ${checkNull(blockReason.isManuallyBlocked)})`;

      expect(result).to.have.string(`VALUES ${value}`);
    });
  });

  describe('stringNull', () => {
    it('should escape a string with $separate$', () => {
      expect(stringNull('cat')).to.equal('$sep$cat$sep$');
    });
    it('should escape a string with $sepsep$ if the string is "$sep$"', () => {
      expect(stringNull('$sep$')).to.equal('$sepsep$$sep$$sepsep$');
    });
  });

  describe('util function checkNull', () => {
    it('should return element if defined', () => {
      const element = 'testString';
      const result = checkNull(element);
      expect(result).to.deep.equal(element);
    });
    it('should return Null if element is undefined', () => {
      const element = undefined;
      const result = checkNull(element);
      expect(result).to.deep.equal('NULL');
    });
  });
  describe('util function stringNull', () => {
    it('should return element wrapped in $$ quotes if defined', () => {
      const element = '$$testString$$';
      const result = checkNull(element);
      expect(result).to.deep.equal(element);
    });
    it('should return Null if element is undefined', () => {
      const element = undefined;
      const result = checkNull(element);
      expect(result).to.deep.equal('NULL');
    });
  });
  describe('main BatchManager class', () => {
    it('@slow runs multiple updates', async () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();
      const entities = [product1, product2];
      const updates: Array<{ entities: any[]; transform: BatchTransform }> = [
        {
          entities,
          transform: {
            table: 'block_reason',
            idColumn: 'block_reason_id',
            idColumnToPropertyName: 'blockReasonId',
            transform: (blockReason: BlockReason) => {
              return `(${blockReason.productId}, ${checkNull(blockReason.blockedByProduct)}, ${checkNull(blockReason.termId)}, ${stringNull(blockReason.term)},
                        ${checkNull(blockReason.blockActionId)}, ${stringNull(blockReason.manuallyBlockedReason)}, ${checkNull(blockReason.isActive)}, ${checkNull(blockReason.isManuallyBlocked)})`;
            },
            sql: (statements: string[]) => `
                        INSERT INTO block_reason(product_id, blocked_by_product, term_id, term, block_action_id, manually_blocked_reason, is_active, is_manually_blocked)
                        VALUES ${statements.join(',')}
                        `,
          },
        },
      ];

      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      for (const update of updates) {
        const data = _.map(update.entities, (entity) =>
          update.transform.transform(entity),
        );
        mockPg
          .expects('write')
          .withExactArgs(update.transform.sql(data))
          .resolves();
      }
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      await manager.runMultipleUpdates(updates);
      sinon.verify();
    });
    it('@slow runs batch', async () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();
      const entities = [product1, product2];
      const transform: BatchTransform = {
        table: 'block_reason',
        idColumn: 'block_reason_id',
        idColumnToPropertyName: 'productId',
        transform: (product: Product) => `${product.productId}`,
        sql: (statements: string[]) => `
                    INSERT INTO block_reason(product_id, blocked_by_product, term_id, term, block_action_id, manually_blocked_reason, is_active, is_manually_blocked)
                    VALUES ${statements.join(',')}
                    `,
      };

      mockLogger
        .expects('info')
        .withExactArgs(`Writing batch 0 of ${entities.length} entities `);
      mockPg.expects('write').withExactArgs('BEGIN').resolves();

      const data = _.map(entities, (entity) => transform.transform(entity));
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data))
        .resolves({
          rows: [
            { productId: product1.productId },
            { productId: product2.productId },
          ],
        });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      const result = await manager.runBatch(entities, transform);

      expect(result).to.have.length(2);
      expect(result).to.deep.equal([product1.productId, product2.productId]);
      sinon.verify();
    });
    it('@slow runs batch with error', async () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();
      const entities = [product1, product2];
      const transform: BatchTransform = {
        table: 'block_reason',
        idColumn: 'block_reason_id',
        idColumnToPropertyName: 'blockReasonId',
        transform: (blockReason: BlockReason) => {
          return `(${blockReason.productId}, ${checkNull(blockReason.blockedByProduct)}, ${checkNull(blockReason.termId)}, ${stringNull(blockReason.term)},
                    ${checkNull(blockReason.blockActionId)}, ${stringNull(blockReason.manuallyBlockedReason)}, ${checkNull(blockReason.isActive)}, ${checkNull(blockReason.isManuallyBlocked)})`;
        },
        sql: (statements: string[]) => `
                    INSERT INTO block_reason(product_id, blocked_by_product, term_id, term, block_action_id, manually_blocked_reason, is_active, is_manually_blocked)
                    VALUES ${statements.join(',')}
                    `,
      };

      mockLogger
        .expects('info')
        .withExactArgs(`Writing batch 0 of ${entities.length} entities `);
      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      const data = _.map(entities, (entity) => transform.transform(entity));

      const err = Exception.InvalidData('test');
      mockPg.expects('write').withExactArgs(transform.sql(data)).rejects(err);
      mockLogger.expects('error').withExactArgs(err);
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      const result = await manager.runBatch(entities, transform);

      expect(result).to.have.length(0);
      sinon.verify();
    });

    it('runs runPaginatedUpdateBatch', async () => {
      const dpvCombination1 = ModelFactory.dpvCombination({
        sourceValue: ['Indie Pop', 'Folk', 'Instrumental'],
        destinationValue: ['Pop', 'Folk', 'Instrumental'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId: 'music',
      });

      const dpvCombination2 = ModelFactory.dpvCombination({
        sourceValue: ['Indie Pop', 'Instrumental'],
        destinationValue: ['Indie Pop', 'Violin'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId: 'music',
      });

      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();
      const entities = [dpvCombination1, dpvCombination2];
      const rowUpdateLimit = 15000;
      const transform: BatchTransform = {
        table: 'product',
        idColumn: 'entity_id',
        idColumnToPropertyName: 'entityId',
        transform: (dpvCombination: DpvCombination) => `
                WITH audit AS
                (
                    WITH cte AS (
                        SELECT product_id
                        FROM product
                        WHERE LOWER(document->${BatchManager.getClauseString(dpvCombination.fieldSourcePath)}) = ('${JSON.stringify(dpvCombination.sourceValue)}'::JSONB)::TEXT
                        AND NOT LOWER(document->${BatchManager.getClauseString(dpvCombination.fieldPath)}) = ('${JSON.stringify(dpvCombination.destinationValue)}'::JSONB)::TEXT
                        AND document->>'productTypeGroupId'='${dpvCombination.productTypeGroupId}'
                        LIMIT ${rowUpdateLimit})
                    UPDATE product p
                    SET document = jsonb_set(document, '{${BatchManager.getSplittedPathString(dpvCombination.fieldPath)}}', '${JSON.stringify(dpvCombination.destinationValue)}')
                    FROM cte
                    WHERE p.product_id = cte.product_id
                    RETURNING p.*)
                INSERT INTO audit_history(action, entity_type, entity_id, context, document)
                SELECT 'UPDATE','product', audit.product_id, '${JSON.stringify({ reason: 'DPV process' })}', row_to_json(audit)
                FROM audit RETURNING entity_id`,
        sql: (statement: string) => statement,
      };

      mockLogger
        .expects('info')
        .withExactArgs(
          `Writing paginated update 0 of ${entities.length} entities`,
        );
      const data = _.map(entities, (entity) => transform.transform(entity));

      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 0 and page 0`,
        );
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[0]))
        .resolves({ rows: [{ entityId: product1.productId }] });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();
      // the last call with the empty result
      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 0 and page 1`,
        );
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[0]))
        .resolves({ rows: [] });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 1 and page 0`,
        );
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[1]))
        .resolves({ rows: [{ entityId: product2.productId }] });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();
      // the last call with the empty result
      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 1 and page 1`,
        );
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[1]))
        .resolves({ rows: [] });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      const updatedProductIds = await manager.runPaginatedUpdateBatch(
        entities,
        transform,
      );

      expect(updatedProductIds).to.deep.equal([
        product1.productId,
        product2.productId,
      ]);
      expect(updatedProductIds.length).to.equal(2);

      sinon.verify();
    });

    it('runs runPaginatedUpdateBatch with an error', async () => {
      const dpvCombination1 = ModelFactory.dpvCombination({
        sourceValue: ['Indie Pop', 'Folk', 'Instrumental'],
        destinationValue: ['Pop', 'Folk', 'Instrumental'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId: 'music',
      });

      const entities = [dpvCombination1];
      const rowUpdateLimit = 15000;
      const transform: BatchTransform = {
        table: 'product',
        idColumn: 'entity_id',
        idColumnToPropertyName: 'entityId',
        transform: (dpvCombination: DpvCombination) => `
                WITH audit AS
                (
                    WITH cte AS (
                        SELECT product_id
                        FROM product
                        WHERE LOWER(document->${BatchManager.getClauseString(dpvCombination.fieldSourcePath)}) = ('${JSON.stringify(dpvCombination.sourceValue)}'::JSONB)::TEXT
                        AND NOT LOWER(document->${BatchManager.getClauseString(dpvCombination.fieldPath)}) = ('${JSON.stringify(dpvCombination.destinationValue)}'::JSONB)::TEXT
                        AND document->>'productTypeGroupId'='${dpvCombination.productTypeGroupId}'
                        LIMIT ${rowUpdateLimit})
                    UPDATE product p
                    SET document = jsonb_set(document, '{${BatchManager.getSplittedPathString(dpvCombination.fieldPath)}}', '${JSON.stringify(dpvCombination.destinationValue)}')
                    FROM cte
                    WHERE p.product_id = cte.product_id
                    RETURNING p.*)
                INSERT INTO audit_history(action, entity_type, entity_id, context, document)
                SELECT 'UPDATE','product', audit.product_id, '${JSON.stringify({ reason: 'DPV process' })}', row_to_json(audit)
                FROM audit RETURNING entity_id`,
        sql: (statement: string) => statement,
      };

      mockLogger
        .expects('info')
        .withExactArgs(
          `Writing paginated update 0 of ${entities.length} entities`,
        );
      const data = _.map(entities, (entity) => transform.transform(entity));

      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 0 and page 0`,
        );

      const err = Exception.InvalidData('test');
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[0]))
        .rejects(err);
      mockLogger.expects('error').withExactArgs(err);
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      const updatedProductIds = await manager.runPaginatedUpdateBatch(
        entities,
        transform,
      );
      expect(updatedProductIds).to.be.empty;

      sinon.verify();
    });

    it('runs runPaginatedUpdateBatch with an error and continuing with the next entity', async () => {
      const dpvCombination1 = ModelFactory.dpvCombination({
        sourceValue: ['Indie Pop', 'Folk', 'Instrumental'],
        destinationValue: ['Pop', 'Folk', 'Instrumental'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId: 'music',
      });

      const dpvCombination2 = ModelFactory.dpvCombination({
        sourceValue: ['Indie Pop', 'Instrumental'],
        destinationValue: ['Indie Pop', 'Violin'],
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId: 'music',
      });

      const product2 = ModelFactory.product();
      const entities = [dpvCombination1, dpvCombination2];
      const rowUpdateLimit = 15000;
      const transform: BatchTransform = {
        table: 'product',
        idColumn: 'entity_id',
        idColumnToPropertyName: 'entityId',
        transform: (dpvCombination: DpvCombination) => `
                WITH audit AS
                (
                    WITH cte AS (
                        SELECT product_id
                        FROM product
                        WHERE LOWER(document->${BatchManager.getClauseString(dpvCombination.fieldSourcePath)}) = ('${JSON.stringify(dpvCombination.sourceValue)}'::JSONB)::TEXT
                        AND NOT LOWER(document->${BatchManager.getClauseString(dpvCombination.fieldPath)}) = ('${JSON.stringify(dpvCombination.destinationValue)}'::JSONB)::TEXT
                        AND document->>'productTypeGroupId'='${dpvCombination.productTypeGroupId}'
                        LIMIT ${rowUpdateLimit})
                    UPDATE product p
                    SET document = jsonb_set(document, '{${BatchManager.getSplittedPathString(dpvCombination.fieldPath)}}', '${JSON.stringify(dpvCombination.destinationValue)}')
                    FROM cte
                    WHERE p.product_id = cte.product_id
                    RETURNING p.*)
                INSERT INTO audit_history(action, entity_type, entity_id, context, document)
                SELECT 'UPDATE','product', audit.product_id, '${JSON.stringify({ reason: 'DPV process' })}', row_to_json(audit)
                FROM audit RETURNING entity_id`,
        sql: (statement: string) => statement,
      };

      mockLogger
        .expects('info')
        .withExactArgs(
          `Writing paginated update 0 of ${entities.length} entities`,
        );
      const data = _.map(entities, (entity) => transform.transform(entity));

      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 0 and page 0`,
        );

      const err = Exception.InvalidData('test');
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[0]))
        .rejects(err);
      mockLogger.expects('error').withExactArgs(err); // skip erroneous request
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 1 and page 0`,
        );
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[1]))
        .resolves({ rows: [{ entityId: product2.productId }] });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();
      // the last call with the empty result
      mockPg.expects('write').withExactArgs('BEGIN').resolves();
      mockLogger
        .expects('info')
        .withExactArgs(
          `Trying to write the paginated update for a data with index 1 and page 1`,
        );
      mockPg
        .expects('write')
        .withExactArgs(transform.sql(data[1]))
        .resolves({ rows: [] });
      mockPg.expects('write').withExactArgs('COMMIT').resolves();

      const updatedProductIds = await manager.runPaginatedUpdateBatch(
        entities,
        transform,
      );
      expect(updatedProductIds).to.deep.equal([product2.productId]);
      expect(updatedProductIds.length).to.equal(1);

      sinon.verify();
    });
  });

  describe('getProductUpdateTransform', () => {
    it('should create a sql request to updated products by dpv', () => {
      const sourceValue = ['Indie Pop', 'Folk', 'Instrumental'];
      const destinationValue = ['Pop', 'Folk', 'Instrumental'];
      const fieldPath = 'meta.genres';
      const fieldSourcePath = 'source.genres';
      const productTypeGroupId = 'music';
      const dpvCombination1 = ModelFactory.dpvCombination({
        sourceValue,
        destinationValue,
        fieldPath,
        fieldSourcePath,
        productTypeGroupId,
      });

      const data =
        BatchManager.getProductUpdateTransform().transform(dpvCombination1);
      const result = BatchManager.getProductUpdateTransform().sql(data);
      expect(result).to.have.string(
        `WHERE LOWER(document->'source'->>'genres') = ('["Indie Pop","Folk","Instrumental"]'::JSONB)::TEXT`,
      );
      expect(result).to.have.string(
        `AND NOT LOWER(document->'meta'->>'genres') = ('["pop","folk","instrumental"]'::JSONB)::TEXT`,
      );
      expect(result).to.have.string(
        `AND document->>'productTypeGroupId'='music'`,
      );
      expect(result).to.have.string(
        `SET document = jsonb_set(document, '{"meta","genres"}', '["Pop","Folk","Instrumental"]`,
      );
    });

    it('should create a sql request to updated products by dpv for the field path with more levels', () => {
      const sourceValue = ['Indie Pop', 'Folk', 'Instrumental'];
      const destinationValue = ['Pop', 'Folk', 'Instrumental'];
      const fieldPath = 'meta.basePrice.price.subPrice';
      const fieldSourcePath = 'source.basePrice.price';
      const productTypeGroupId = 'music';
      const dpvCombination1 = ModelFactory.dpvCombination({
        sourceValue,
        destinationValue,
        fieldPath,
        fieldSourcePath,
        productTypeGroupId,
      });

      const data =
        BatchManager.getProductUpdateTransform().transform(dpvCombination1);
      const result = BatchManager.getProductUpdateTransform().sql(data);
      expect(result).to.have.string(
        `WHERE LOWER(document->'source'->'basePrice'->>'price') = ('["Indie Pop","Folk","Instrumental"]'::JSONB)::TEXT`,
      );
      expect(result).to.have.string(
        `AND NOT LOWER(document->'meta'->'basePrice'->'price'->>'subPrice') = ('["pop","folk","instrumental"]'::JSONB)::TEXT`,
      );
      expect(result).to.have.string(
        `AND document->>'productTypeGroupId'='music'`,
      );
      expect(result).to.have.string(
        `SET document = jsonb_set(document, '{"meta","basePrice","price","subPrice"}', '["Pop","Folk","Instrumental"]`,
      );
    });
  });
});
