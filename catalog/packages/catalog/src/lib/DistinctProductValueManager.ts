import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { SpLite } from '@securustablets/libraries.json-schema';
import { Logger } from '@securustablets/libraries.logging';
import { MessagingManager } from '@securustablets/libraries.messaging';
import { DeepPartial, _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { DistinctProductValue } from '../controllers/models/DistinctProductValue';
import {
  DistinctProductFieldPath,
  Product,
} from '../controllers/models/Product';
import { DistinctProductValueDao } from '../data/PGCatalog/DistinctProductValueDao';
import { MessagingConstants } from '../messaging/MessagingConstants';
import { AppConfig } from '../utils/AppConfig';
import { AuditContext } from './models/AuditContext';

@Singleton
export class DistinctProductValueManager {
  @Inject
  private distinctProductValueDao!: DistinctProductValueDao;

  @Inject
  private messagingManager!: MessagingManager;

  @Inject
  private logger: Logger;

  public findOneOrFail = this.distinctProductValueDao.findOneOrFail;
  public findByQueryString = this.distinctProductValueDao.findByQueryString;

  /**
   * gets or inserts if not found into the distinctProductValue.
   *
   * e.g. fieldPathType - 'genre', productTypeGroupId = 'music', sourceValueNames - 'pop'
   * returns  => { distinctProductValueId: 1, fieldPath: 'genre', productTypeGroupId: 'music', sourceValueName: 'pop',
   * displayName: 'pop', cdate: 'date string', udate: 'date string' }
   */
  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlShort,
  })
  @MethodCache(Csi.Tier3, {
    secondsToLive: Container.get(AppConfig).cache.ttlMedium,
  })
  private async getOrSetDistinctProductsByValueName(
    fieldPath: string,
    productTypeGroupId: string,
    sourceValueName: string,
    context: AuditContext,
  ): Promise<DistinctProductValue> {
    const distinctProductValues =
      await this.distinctProductValueDao.findByPathAndGroupAndSourceValue(
        fieldPath,
        productTypeGroupId,
        sourceValueName,
      );
    if (!_.isEmpty(distinctProductValues)) {
      // found existing DPV, return that instead of creating a new one
      return distinctProductValues[0];
    }
    const distinctProductValue = {
      fieldPath: fieldPath,
      productTypeGroupId: productTypeGroupId,
      sourceValueName: sourceValueName,
      displayName: sourceValueName,
    } as DistinctProductValue;

    if (distinctProductValue.fieldPath === DistinctProductFieldPath.Genres) {
      // normalize source.genres when writing to DB
      distinctProductValue.sourceValueName =
        distinctProductValue.sourceValueName.toString().toLowerCase();
    }
    return this.distinctProductValueDao.createAndRetrieve(
      distinctProductValue,
      context,
    );
  }

  /**
   * gets or inserts if not found into the distinctProductValue and returns a object.
   * in the e.g below - gets the row for the value 'pop' and inserts the row for the value 'rock'.
   * e.g. fieldPath - 'genre', productTypeGroupId = 'music', sourceValueNames - ['pop', 'rock']
   * returns  =>
   * {'genre':
   *      {
   *      'pop': {
   *         distinctProductValueId: 1,
   *         fieldPath: 'genre',
   *         productTypeGroupId: 'music',
   *         sourceValueName: 'pop',
   *         displayName: 'pop',
   *         cdate: 'date string',
   *         udate: 'date string'
   *       },
   *       'rock': {
   *         fieldPath: 'genre',
   *         productTypeGroupId: 'music',
   *         sourceValueName: 'rock',
   *         displayName: 'rock',
   *         cdate: 'date string',
   *         udate: 'date string'
   *       }
   *  }
   * @param schema
   * @param product
   * @param context
   * @returns objects as below
   * e.g - 1
   * { "purchase": { "1.5": {"distinctProductValueId": 10,"fieldPath": "purchase","productTypeGroupId": "music","sourceValueName": "1.5",
   * "displayName": "1.5","cdate": "2022-04-21T17:04:49.602Z","udate": "2022-04-21T17:04:49.602Z"}}}
   *
   * e.g -2
   * { "categories": { "Books": {"distinctProductValueId": 8,"fieldPath": "categories","productTypeGroupId": "music","sourceValueName": "Books",
   * "displayName": "Books","cdate": "2022-04-21T17:04:49.604Z","udate": "2022-04-21T17:04:49.604Z"}}}
   */
  public async getOrCreateValueTableRecordsForField(
    schema: SpLite,
    product: Product,
    context: AuditContext,
  ): Promise<{
    [fieldPath: string]: { [sourceValueName: string]: DistinctProductValue };
  }> {
    const value = _.get(product, schema.path);
    if (value) {
      const distinctProducts = await Bluebird.map(
        _.castArray(value),
        async (sourceValueName: string) =>
          await this.getOrSetDistinctProductsByValueName(
            schema.distinctValue,
            product.productTypeGroupId,
            sourceValueName,
            context,
          ),
        { concurrency: 1 },
      );
      return {
        [schema.distinctValue]: this.arrayToObject(
          distinctProducts,
          'sourceValueName',
        ),
      };
    }
  }

  /**
   * Creates an object with the index key as the key and object as the value of it.
   *
   * e.g. when the indexKey - sourceValueName
   * [{id: 1, sourceValueName: 'name1'}, {id: 2, sourceValueName: 'name2'}] => {name1: {id: 1, sourceValueName: 'name1'}, name2: {id: 2, sourceValueName: 'name2'} }
   */
  private arrayToObject<T>(array: T[], indexKey: keyof T) {
    const dictionaryObject: any = {};
    array.forEach((item) => {
      const key = item[indexKey];
      dictionaryObject[key] = item;
    });
    return dictionaryObject as { [key: string]: T };
  }

  public async updateBulk(
    ids: number[],
    data: DeepPartial<DistinctProductValue>,
    authContext: SvSecurityContext,
  ): Promise<DistinctProductValue[]> {
    const dpvIds = _.uniq(ids);
    const dpvs = await this.distinctProductValueDao.find({ ids: dpvIds });

    // Throw an error if an update contains invalid IDs
    if (dpvIds.length !== dpvs.length) {
      const missingIds = _.difference(
        dpvIds,
        _.map(dpvs, 'distinctProductValueId'),
      );
      this.logger.error(`Invalid DPV IDs: ${JSON.stringify(missingIds)}`);
      throw Exception.NotFound({
        errors: { message: 'Invalid DPV IDs submitted for update', missingIds },
      });
    }

    // Throw an error if an update is submitted for a non-genre dpv
    const invalidUpdates = dpvs.filter(
      (i) => i.fieldPath !== DistinctProductFieldPath.Genres,
    );
    if (!_.isEmpty(invalidUpdates)) {
      this.logger.error(
        `Invalid DPVs detected in update: ${JSON.stringify(invalidUpdates)}`,
      );
      throw Exception.InvalidData({
        errors: {
          message:
            'Invalid DPVs submitted for update. Only meta.genre supports displayName changes',
          invalidUpdates,
          dpvIds,
        },
      });
    }

    // Update the DPVs with the new data (displayName) and publish the message
    return Bluebird.map(
      dpvs,
      async (dpv: DistinctProductValue) => {
        const update = _.merge(dpv, data);
        const updated = await this.distinctProductValueDao.updateAndRetrieve(
          dpv.distinctProductValueId,
          update,
          authContext,
        );
        await this.messagingManager.publish(
          MessagingConstants.PUBLICATION_ID,
          `dpv.${updated.productTypeGroupId}.updated`,
          updated,
        );
        return updated as DistinctProductValue;
      },
      { concurrency: 5 },
    );
  }

  public async getDistinctProductValuesByProductTypeGroupId(
    productTypeGroupId: string,
  ): Promise<DistinctProductValue[]> {
    return this.distinctProductValueDao.find({ by: { productTypeGroupId } });
  }
}
