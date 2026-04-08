// tslint:disable: no-console
import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as glob from 'glob';
import * as TJS from 'typescript-json-schema';
import * as yargs from 'yargs';

export class GenerateSchemasCommand implements yargs.CommandModule {
  public command = 'generate-schemas';
  public describe = 'Generates product schemas';

  public async handler() {
    // only produce schemas for product types, not the base product
    const schemaGlob = 'db/reference/*Schema.ts';
    const settings: TJS.PartialArgs = {
      required: true,
      validationKeywords: [
        'autoComplete',
        'requiredIfActive',
        'keyField',
        'distinctValue',
      ],
      ref: false,
    };

    const interfaceFilePaths = glob.sync(schemaGlob);
    console.log(`Generating schemas for [${interfaceFilePaths.join(', ')}]`);

    const program = TJS.getProgramFromFiles(interfaceFilePaths);
    const generator = TJS.buildGenerator(program, settings);
    const errors: any[] = [];
    const pg = Postgres.getInstance();
    for (const filename of interfaceFilePaths) {
      const interfaceName = filename
        .replace('db/reference/', '')
        .replace('.ts', '')
        .replace('Schema', '');
      try {
        const iface = generator!.getSchemaForSymbol(interfaceName);
        const productTypeId = GenerateSchemasCommand.getProductTypeId(iface); // get the productTypeId string from the interface
        const productTypeGroupId =
          GenerateSchemasCommand.getProductTypeGroupId(iface); // get the productTypeGroupId string from the interface
        const purchaseCode = GenerateSchemasCommand.getPurchaseCode(iface); // retrieve the purchase code (if any) from the interface
        const purchaseTypes = GenerateSchemasCommand.getPurchaseTypes(iface); // format the purchaseTypes as a postgres array
        const fulfillmentType =
          GenerateSchemasCommand.getFulfillmentType(iface); // format the fulfillmentType as a string
        const subscribable = GenerateSchemasCommand.getSubscribableFlag(iface); // get the subscribable value
        const fileData =
          'INSERT INTO product_type (product_type_id, product_type_group_id, subscribable, purchase_code, purchase_types, available, fulfillment_type, json_schema) VALUES ' +
          `(${productTypeId},${productTypeGroupId},${subscribable},${purchaseCode},${purchaseTypes},false,${fulfillmentType},$$${JSON.stringify(iface)}$$)\n` +
          `ON CONFLICT (product_type_id) DO UPDATE SET (purchase_code, purchase_types, product_type_group_id, fulfillment_type, json_schema) = ` +
          `(EXCLUDED.purchase_code, EXCLUDED.purchase_types, EXCLUDED.product_type_group_id, EXCLUDED.fulfillment_type, EXCLUDED.json_schema)`;
        await pg.write(fileData);
        console.log(`Wrote Schema ${productTypeId}`);
      } catch (err) {
        errors.push({ interfaceName, err: err.stack });
      }
    }
    if (errors.length) {
      console.error(JSON.stringify(errors, null, 2));
    }
    console.log(`All schemas written to database`);
    return pg.end();
  }

  /**
   * Extract single value from schema - supports both legacy enum[0] and new const format from typescript-json-schema 0.67+
   */
  private static getSchemaValue(
    schema: any,
  ): string | number | boolean | undefined {
    if (schema?.const !== undefined) return schema.const;
    return _.get(schema, 'enum[0]');
  }

  private static getPurchaseTypes(iface: any): string {
    const purchaseTypesSchema = _.get(iface, 'properties.purchaseTypes');
    let purchaseTypes: (string | number | boolean)[] = [];
    if (
      !_.isUndefined(purchaseTypesSchema?.minItems) &&
      Array.isArray(purchaseTypesSchema.items)
    ) {
      purchaseTypes = purchaseTypesSchema.items
        .map((i: any) => GenerateSchemasCommand.getSchemaValue(i))
        .filter((v): v is string | number | boolean => v !== undefined);
    }
    // postgres format the array
    return `'${JSON.stringify(purchaseTypes).replace('[', '{').replace(']', '}')}'`;
  }

  private static getProductTypeId(iface: any): string {
    const val = GenerateSchemasCommand.getSchemaValue(
      _.get(iface, 'properties.productTypeId'),
    );
    return `'${val ?? ''}'`;
  }
  private static getProductTypeGroupId(iface: any): string {
    const val = GenerateSchemasCommand.getSchemaValue(
      _.get(iface, 'properties.productTypeGroupId'),
    );
    return `'${val ?? ''}'`;
  }
  private static getFulfillmentType(iface: any): string {
    const val = GenerateSchemasCommand.getSchemaValue(
      _.get(iface, 'properties.fulfillmentType'),
    );
    return `'${val ?? ''}'`;
  }
  private static getPurchaseCode(iface: any): string | null {
    const val = GenerateSchemasCommand.getSchemaValue(
      _.get(iface, 'properties.purchaseCode'),
    );
    return val !== undefined && val !== null ? `'${val}'` : null;
  }
  private static getSubscribableFlag(iface: any): string {
    const val = GenerateSchemasCommand.getSchemaValue(
      _.get(iface, 'properties.subscribable'),
    );
    // Default to false when subscribable is optional/undefined - PostgreSQL expects boolean
    return val === true ? 'true' : 'false';
  }
}
