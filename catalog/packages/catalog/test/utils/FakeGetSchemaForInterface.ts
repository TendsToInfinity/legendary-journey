import schemas = require('./Schemas.json');

export function fakeGetSchemaForInterface(modelName: string) {
  return schemas[modelName];
}
