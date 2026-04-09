import {
  JsonSchemaParser,
  SpAttributes,
} from '@securustablets/libraries.json-schema';
import { Logger } from '@securustablets/libraries.logging';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { DistinctProductValue } from '../../controllers/models/DistinctProductValue';
import { BatchManager } from '../../data/BatchManager';
import { ProductDao } from '../../data/PGCatalog/ProductDao';
import { DistinctProductValueManager } from '../../lib/DistinctProductValueManager';
import { ProductTypeManager } from '../../lib/ProductTypeManager';
import { ProductPublishManager } from '../../lib/product/ProductPublishManager';
import _ = require('lodash');

export interface DpvCombination {
  sourceValue: string[]; // the genre array, for example
  destinationValue: string[]; // the genre array, for example
  fieldPath: string; // 'meta.genres'
  fieldSourcePath: string; // 'source.genres'
  productTypeGroupId: string;
}

@Singleton
export class DistinctProductValueLie {
  @Inject
  private batchManager: BatchManager;

  @Inject
  private productDao: ProductDao;

  @Inject
  private productPublishManager: ProductPublishManager;

  @Inject
  private productTypeManager: ProductTypeManager;

  @Inject
  private distinctProductValueManager: DistinctProductValueManager;

  @Inject
  private logger: Logger;

  public async dpvProcessHandler(dpv: DistinctProductValue): Promise<void> {
    const sourcePath = await this.findSourcePathInSchema(dpv);
    if (sourcePath) {
      const productsDistinctValuesLowerCase =
        await this.productDao.getAllDistinctProductValueCombinations(
          sourcePath,
          dpv.productTypeGroupId,
          dpv.sourceValueName,
        );
      const dpvs =
        await this.distinctProductValueManager.getDistinctProductValuesByProductTypeGroupId(
          dpv.productTypeGroupId,
        ); // gets all DPVs by productTypeGroupId
      const dpvCombinations: DpvCombination[] = [];
      productsDistinctValuesLowerCase.forEach((dv) => {
        // generates new genres for the current state from DPV
        // removes duplicates case insensitive
        // updates the value in the very recent register
        const newGenres = _.reverse(
          _.uniqBy(
            // the reversing is used for the replacing with the current element value to get uniue array of elements.
            // for instance, we had 2 genres in a product - [Ab,Cd]. Replacing sequentially Ab -> AAA, getting the result - [AAA,Cd].
            // The next replacing is Cd ->aaa. The result is going to be [aaa], not [AAA], because the aaa is the last version of the replacing
            _.reverse(
              _.map(
                _.filter(dpvs, (dpvItem) => {
                  return dv.includes(dpvItem.sourceValueName.toLowerCase());
                }),
                'displayName',
              ),
            ),
            (value) => value.trim().toLowerCase(),
          ),
        );
        const dpvCombination = {
          sourceValue: dv, // the genre array, for example
          destinationValue: newGenres, // the genre array, for example
          fieldPath: dpv.fieldPath, // 'meta.genres'
          fieldSourcePath: sourcePath, // 'source.genres'
          productTypeGroupId: dpv.productTypeGroupId,
        };
        dpvCombinations.push(dpvCombination);
      });
      if (dpvCombinations.length > 0) {
        const updatedProductIds =
          await this.batchManager.runPaginatedUpdateBatch(
            dpvCombinations,
            BatchManager.getProductUpdateTransform(),
          );

        // Send out rmq message for all product updates in batches of 1000
        const rmqBatchSize = 1000;
        for (let i = 0; i < updatedProductIds.length; i += rmqBatchSize) {
          const rmqBatch = updatedProductIds.slice(i, i + rmqBatchSize);
          await Bluebird.map(
            rmqBatch,
            async (productId) => {
              const product = await this.productDao.findOne(productId);
              await this.productPublishManager.publishProductMessage(product);
            },
            { concurrency: 10 },
          );
          await Bluebird.delay(500);
        }
      }
    } else {
      this.logger.error(
        `A source path for the Field Value not found. distinctProductValueId: ${dpv.distinctProductValueId}`,
      );
      throw Exception.InternalError({
        errors: [
          `A source path for the Field Value not found. distinctProductValueId: ${dpv.distinctProductValueId}`,
        ],
      });
    }
  }

  private async findSourcePathInSchema(
    dpv: DistinctProductValue,
  ): Promise<string | undefined> {
    const productTypes = await this.productTypeManager.getProductTypes();
    const productTypesForDPV = productTypes.filter(
      (pType) => pType.productTypeGroupId === dpv.productTypeGroupId,
    );
    // search for dpv.fieldPath in productTypeGroup schemas
    const sourcePaths: string[] = [];
    // todo: remove excessive search here
    productTypesForDPV.forEach((pt) => {
      const jsp = new JsonSchemaParser(pt.jsonSchema);
      const schemas = jsp.getSchemasWithField(SpAttributes.DistinctValue); // to get the sourcePath from decorators. It could be an empty array!
      const path = schemas.find(
        (item) => item.distinctValue === dpv.fieldPath,
      )?.path;
      if (path) {
        sourcePaths.push(path);
      }
    });
    return sourcePaths[0]; // the sourcePath linked to dpv.fieldPath
  }
}
