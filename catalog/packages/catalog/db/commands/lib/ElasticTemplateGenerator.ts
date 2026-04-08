import { Client } from '@opensearch-project/opensearch';
import { Schema } from '@securustablets/libraries.json-schema';
import { Logger } from '@securustablets/libraries.logging';
import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Inject } from 'typescript-ioc';
import { OpenSearchHelper } from '../../../src/lib/OpenSearchHelper';
import { ProductTypeManager } from '../../../src/lib/ProductTypeManager';
import { ProductType } from '../../../src/lib/models/ProductType';
import { AppConfig } from '../../../src/utils/AppConfig';

export class ElasticTemplateGenerator {
  @Inject
  private productTypeManager!: ProductTypeManager;

  @Inject
  private logger!: Logger;

  @Inject
  private config!: AppConfig;

  private client: Client;

  public async handle(args: any) {
    let productTypeIds: string[] = args.productTypeIds || [];
    this.client = new Client({
      node: this.config.openSearch.host,
      auth: {
        username: this.config.openSearch.user,
        password: this.config.openSearch.pass,
      },
      compression: 'gzip',
    });
    const productTypes = await this.productTypeManager.getProductTypes();
    if (productTypeIds.length === 0) {
      productTypeIds = _.map(productTypes, 'productTypeId');
    }
    this.logger.info(
      `Processing productTypes: ${JSON.stringify(productTypes.map((i) => i.productTypeId))}`,
    );

    await Bluebird.map(
      productTypes,
      async (productType) => {
        if (!productTypeIds.includes(productType.productTypeId)) {
          return;
        }
        const template = this.getProductTypeElasticTemplate(productType);
        this.logger.info(`Putting template for ${productType.productTypeId}`);
        const templateResult = await this.syncProductType(
          productType.productTypeId,
          template,
        );
        this.logger.info(JSON.stringify(templateResult));
        if (_.get(templateResult, 'meta.body.error')) {
          this.logger.info(
            JSON.stringify(templateResult.meta.body.error, null, 2),
          );
        }
      },
      { concurrency: 1 },
    );

    const pg = Postgres.getInstance();
    return pg.end();
  }

  private getProductTypeElasticTemplate(productType: ProductType): any {
    const schema: Schema = productType.jsonSchema;
    return {
      index_patterns: `${productType.productTypeId.toLowerCase()}_*`,
      template: {
        aliases: {
          [`${productType.productTypeId.toLowerCase()}_search`]: {},
        },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          properties: {
            ...this.getTree(schema, {}),
            digest: {
              properties: {
                ruleIds: { type: 'long' },
                whitelist: this.getElasticFieldDef('string', 'whitelist'),
                blacklist: this.getElasticFieldDef('string', 'whitelist'),
                subscriptionProductIds: { type: 'long' },
                sales: {
                  properties: {
                    totalSales: this.getElasticFieldDef('number', 'totalSales'),
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private getTree(node: Schema, tree: any): any {
    if (!node.properties) {
      return tree;
    }
    _.keys(node.properties).forEach((nodeName) => {
      if (nodeName && nodeName !== 'required') {
        let elasticDef;
        const currNode: Schema = node.properties[nodeName];
        switch (currNode.type) {
          case 'object':
            elasticDef = { properties: { ...this.getTree(currNode, {}) } };
            break;
          case 'array':
            elasticDef = this.getElasticFieldDef(
              _.castArray(_.castArray(currNode.items)[0].type)[0],
              nodeName,
            );
            break;
          default:
            elasticDef = this.getElasticFieldDef(
              _.castArray(currNode.type)[0],
              nodeName,
            );
        }
        _.set(tree, nodeName, elasticDef);
      }
    });
    return tree;
  }

  private getElasticFieldDef(type: string, name: string): any {
    if (name.toLowerCase().includes('date')) {
      return { type: 'date' };
    }
    switch (type) {
      case 'string':
        return { type: 'text', fields: { keyword: { type: 'keyword' } } };
      case 'number':
        return { type: 'float' };
      case 'boolean':
        return { type: 'boolean' };
    }
  }

  /**
   * This method:
   *  1. PUTs a new index_template up for the productTypeId
   *  2. If a ${productTypeId}_main index already exists
   *      2.a. Applies the mapping from the updated template to the existing index
   *  3. If a ${productTypeId}_main index DOES NOT exist
   *      3.a. Creates a blank index for the productTypeId
   *
   *  4. NOTE; Indexes are aliased to ${productTypeId}_search from the index_template
   * @param productTypeId
   * @param template
   */
  private async syncProductType(
    productTypeId: string,
    template: any,
  ): Promise<any> {
    const index = OpenSearchHelper.getIndexFromProductTypeId(productTypeId);

    // always put the template, it needs to be there before new indexes are created
    const templateResult = await this.client.indices.putIndexTemplate({
      name: productTypeId.toLowerCase(),
      body: template,
    });
    this.logger.info(JSON.stringify(templateResult));

    const indexExists = await this.client.indices.exists({ index });
    // check if the index exists for the productTypeId
    if (indexExists.body) {
      // put mapping from template to existing index
      this.logger.info(`Found index ${index}`);
      this.logger.info(
        `Applying mapping: ${JSON.stringify(template.template.mappings)}`,
      );
      const mappingResult = await this.client.indices.putMapping({
        index,
        body: template.template.mappings,
      });
      this.logger.info('Put Mapping result');
      this.logger.info(JSON.stringify(mappingResult));
    } else {
      this.logger.info(
        `Index not found ${index}, ${JSON.stringify(indexExists)}`,
      );
      // Create the index, the alias should already be made by the template
      const indexCreateResult = await this.client.indices.create({ index });
      this.logger.info('Index create result');
      this.logger.info(JSON.stringify(indexCreateResult));
    }
  }
}
