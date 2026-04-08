/* tslint:disable:no-console */
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { SpAttributes } from '@securustablets/libraries.json-schema/dist/src/models/SpLite';
import { Postgres } from '@securustablets/libraries.postgres';
import { Container, Inject } from 'typescript-ioc';
import { CatalogService } from '../../src/CatalogService';
import { DistinctProductValueDao } from '../../src/data/PGCatalog/DistinctProductValueDao';
import { ProductDao } from '../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../src/data/PGCatalog/ProductTypeDao';

CatalogService.bindAll();

export class AddDistinctProductValues {
  @Inject
  private productTypeDao!: ProductTypeDao;

  @Inject
  private productDao!: ProductDao;

  @Inject
  private distinctProductValueDao!: DistinctProductValueDao;

  public async run(): Promise<void> {
    // Get all product types
    const allProductTypes = await this.productTypeDao.find({
      pageSize: Number.MAX_SAFE_INTEGER,
    });

    for (const productType of allProductTypes) {
      if (productType.productTypeGroupId !== 'music') {
        const jsp = new JsonSchemaParser(productType.jsonSchema);
        const schemas = jsp.getSchemasWithField(SpAttributes.DistinctValue);
        // loop all fields schema
        for (const schema of schemas) {
          await this.getValuesForSchema(
            productType.productTypeId,
            schema,
            productType.productTypeGroupId,
          );
        }
      }
    }
  }

  private async getValuesForSchema(
    productTypeId,
    schema,
    productTypeGroupId,
  ): Promise<void> {
    if (schema.enum) {
      console.log(
        `schema enum found for value_type - ${schema.name}, productTypeId - ${productTypeId}`,
      );
    } else {
      try {
        const distinctValues = await this.productDao.findDistinctForSchema(
          productTypeId,
          schema,
        );
        // convert the strings to numbers based on the type in the schema or schema.items type
        if (distinctValues && distinctValues.length > 0) {
          for (const value of distinctValues) {
            const json = {
              fieldPath: schema.distinctValue,
              productTypeGroupId: productTypeGroupId,
              sourceValueName: value,
              displayName: value,
            };
            // check duplicate before inserting locally
            // const isDuplicate = this.isDuplicate(json);

            // check duplicate before inserting using db
            const isDuplicateDB =
              await this.distinctProductValueDao.findByPathAndGroupAndSourceValue(
                json.fieldPath,
                productTypeGroupId,
                value,
              );
            if (isDuplicateDB.length > 0) {
              console.log(
                `duplicate found for schema name - ${schema.name}, field_path - ${schema.distinctValue}, productTypeId - ${productTypeId}`,
              );
            } else {
              if (!value) {
                console.log(
                  `value not exist for schema name - ${schema.name}, field_path - ${schema.distinctValue}, productTypeId - ${productTypeId}`,
                );
              } else {
                await this.distinctProductValueDao.createAndRetrieve(
                  json as any,
                  {},
                );
              }
            }
          }
        } else {
          console.log(
            `nothing found for schema name - ${schema.name}, field_path - ${schema.distinctValue}, productTypeId - ${productTypeId}`,
          );
        }
      } catch (err) {
        console.log(
          `Received an error while updating distinctProductValue for the field_path - ${schema.distinctValue}, productTypeId - ${productTypeId}`,
          err,
        );
      }
    }
  }

  // private isDuplicate(json): boolean {
  //     let isDuplicate = false;
  //     if (array.length === 0) {
  //         isDuplicate = false;
  //     } else {
  //         for (let o of array) {
  //             if (o.fieldPath === json.fieldPath && o.productTypeGroupId === json.productTypeGroupId && o.sourceValueName === json.sourceValueName) {
  //                 isDuplicate = true;
  //                 break;
  //             }
  //         }
  //     }
  //     array.push(json);
  //     return isDuplicate;
  // }
}

const addDistinctProductValues = new AddDistinctProductValues();
addDistinctProductValues.run().then(() => {
  Container.get(Postgres).end();
});
