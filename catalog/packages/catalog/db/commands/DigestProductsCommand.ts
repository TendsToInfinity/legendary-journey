import * as yargs from 'yargs';
import { ProductDigester } from './lib/ProductDigester';

export class DigestProductsCommand implements yargs.CommandModule {
  public command = 'digest-products';
  public describe = 'Digest products from PG to OpenSearch';

  public builder(args: yargs.Argv) {
    return args
      .option('productTypeId', {
        alias: 'p',
        description: 'The productTypeId to import',
        type: 'string',
        demandOption: true,
      })
      .option('max', {
        alias: 'm',
        description: 'Maximum number of products to pull',
        type: 'number',
        default: Number.MAX_SAFE_INTEGER,
      })
      .option('lastProductId', {
        alias: 'l',
        description: 'Last Product Id to start after',
        type: 'number',
        default: 0,
      })
      .option('pageSize', {
        alias: 's',
        description: 'Page Size',
        type: 'number',
        default: 10000,
      })
      .option('pagesPerBatch', {
        alias: 'b',
        description: 'Number of pages to perform per batch',
        type: 'number',
        default: 5,
      })
      .option('exec', {
        alias: 'e',
        description: 'Execute',
        type: 'boolean',
        default: false,
      })
      .option('verbose', {
        alias: 'v',
        description: 'Show detailed data logs',
        type: 'boolean',
        default: false,
      });
  }

  public async handler(args) {
    const dp = new ProductDigester();
    await dp.handle(args);
  }
}
