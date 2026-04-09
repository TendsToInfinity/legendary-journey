import * as yargs from 'yargs';
import { ElasticTemplateGenerator } from './lib/ElasticTemplateGenerator';

export class PutOpenSearchTemplatesCommand implements yargs.CommandModule {
  public command = 'put-templates';
  public describe =
    'Sync ProductType JSONSchema into OpenSearch indexTemplates and mappings';

  public builder(args: yargs.Argv) {
    return args.option('productTypeIds', {
      alias: 'p',
      description: 'A list of productTypeId to put schemas for',
      type: 'string',
      array: true,
      demandOption: false,
      requiresArg: true,
    });
  }

  public async handler(args) {
    const templateGenerator = new ElasticTemplateGenerator();
    await templateGenerator.handle(args);
  }
}
