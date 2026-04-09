import {
  CacheContainer,
  Csi,
  MethodCache,
} from '@securustablets/libraries.cache';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { SpAttributes } from '@securustablets/libraries.json-schema/dist/src/models/SpLite';
import { Logger } from '@securustablets/libraries.logging';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { ProductTypeIds } from '../controllers/models/Product';
import { ProductAggFields } from '../controllers/models/ProductAggFields';
import { RuleType } from '../controllers/models/Rule';
import { Context } from '../controllers/models/Search';
import { DistinctProductValueDao } from '../data/PGCatalog/DistinctProductValueDao';
import { ProductTypeDao } from '../data/PGCatalog/ProductTypeDao';
import { RuleDao } from '../data/PGCatalog/RuleDao';
import { AppConfig } from '../utils/AppConfig';
import { ProductType } from './models/ProductType';

@Singleton
@CacheContainer(Csi.Tier1, {
  secondsToLive: Container.get(AppConfig).cache.ttlMedium,
})
@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlLong,
})
export class ProductTypeManager {
  @Inject
  private log!: Logger;

  @Inject
  private productTypeDao!: ProductTypeDao;

  @Inject
  private distinctProductValueDao!: DistinctProductValueDao;

  @Inject
  private ruleDao!: RuleDao;

  @Inject
  private config!: AppConfig;

  public update = this.productTypeDao.update;

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async getProductType(
    productTypeId: string,
    context?: Context,
  ): Promise<ProductType> {
    return this.productTypeDao.findOneOrFailByContext(productTypeId, context);
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async getProductTypes(context?: Context): Promise<ProductType[]> {
    const productTypeAvailabilities =
      await this.productTypeDao.findByContext(context);
    if (this.config.catalogLocalMedia.catalogUseLocalMedia) {
      // Whenever local media is used we need to disable musicSubscription availability
      const musicSub = _.find(
        productTypeAvailabilities,
        (p) => p.productTypeId === ProductTypeIds.MusicSubscription,
      );
      musicSub.available = false;
    }
    return productTypeAvailabilities;
  }

  /**
   * ProductTypeAvailability rules only exist at customer or site levels
   * They must be WL to be available, default is unavailable
   * Sort by siteId to find the most relevant rule to the context
   *    rules at every context: {siteId, customerId}, {customerId} = choose siteId rule
   *    rules at customer: {customerId} = choose customerId rule
   *    no rules: false
   */
  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
  })
  public async isProductTypeAvailableForContext(
    productTypeId: string,
    context: Context,
  ): Promise<boolean> {
    const rules = _.filter(
      await this.ruleDao.findSetByContext(
        context,
        RuleType.ProductTypeAvailability,
      ),
      (r) => r.productTypeId === productTypeId,
    );
    return _.get(_.sortBy(rules, 'siteId')[0], 'action.available', false);
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async getProductTypeAggregations(
    productTypeId: string,
  ): Promise<ProductAggFields> {
    const productType = await this.productTypeDao.findOneOrFail(productTypeId);
    const jsp = new JsonSchemaParser(productType.jsonSchema);
    const schemas = jsp.getSchemasByField(SpAttributes.AutoComplete, true);
    const fields = await Bluebird.map(schemas, async (schema) => ({
      values: await this.getValuesForSchema(
        productType.productTypeGroupId,
        schema,
      ),
      name: schema.name,
      path: schema.path,
    }));

    return { fields };
  }

  private async getValuesForSchema(productTypeGroupId, schema): Promise<any[]> {
    if (schema.enum) {
      // if the schema is autoComplete and at path has an enum, return those values rather than looking up in the database
      return schema.enum;
    } else {
      try {
        const distinctValues =
          await this.distinctProductValueDao.getDistinctDisplayForValueAndProductType(
            schema.path,
            productTypeGroupId,
          );
        // convert the strings to numbers based on the type in the schema or schema.items type
        if (
          distinctValues &&
          distinctValues.length > 0 &&
          (schema.type === 'number' ||
            (schema.items && schema.items.type === 'number'))
        ) {
          return distinctValues.map((str) => {
            return Number(str);
          });
        }
        return distinctValues;
      } catch (err) {
        this.log.error(
          `Received an error looking up productAgg in distinctProductValue for the field_path - ${schema.name}, productTypeGroupId - ${productTypeGroupId}`,
          err,
        );
        return [];
      }
    }
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async getValueFromJsonSchemaByFieldName(
    productType: ProductType,
    fieldName: string,
  ): Promise<any[]> {
    const jsp = new JsonSchemaParser(productType.jsonSchema);
    try {
      const schema = jsp.getSchema(fieldName);
      return schema.enum ? schema.enum : [schema.const];
    } catch (err) {
      this.log.notice(
        `Received an error looking up for field - ${fieldName} in the productType - ${productType.productTypeId}`,
        err,
      );
      return [];
    }
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async isFieldPartOfSchema(
    productType: ProductType,
    fieldName: string,
  ): Promise<boolean> {
    const jsp = new JsonSchemaParser(productType.jsonSchema);
    try {
      const schema = jsp.getSchema(fieldName);
      return !!schema;
    } catch (err) {
      this.log.notice(
        `Received an error looking up for field - ${fieldName} in the productType - ${productType.productTypeId}`,
        err,
      );
      return false;
    }
  }
}
