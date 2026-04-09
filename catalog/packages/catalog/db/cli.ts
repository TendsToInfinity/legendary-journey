#!/bin/env ts-node

import * as yargs from 'yargs';
import { DigestProductsCommand } from './commands/DigestProductsCommand';
import { GenerateSchemasCommand } from './commands/GenerateSchemasCommand';
import { PutOpenSearchTemplatesCommand } from './commands/PutOpenSearchTemplatesCommand';

if (require.main === module) {
  // tslint:disable-next-line:no-unused-expression-chai
  yargs
    .command(new GenerateSchemasCommand())
    .command(new DigestProductsCommand())
    .command(new PutOpenSearchTemplatesCommand())
    .recommendCommands()
    .demandCommand(1)
    .wrap(yargs.terminalWidth())
    .strict().argv;
}
