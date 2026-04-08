import { _ } from '@securustablets/libraries.utils';
import * as assert from 'assert';

export function assertIsSorted(items: any[], options: { field: string }) {
  assert.ok(
    items.every((item) => options.field in item),
    `Objects should all have a '${options.field}' field`,
  );
  const values = items.map((item) => item[options.field]);
  const sortedValues = _.clone(values).sort();
  assert.deepStrictEqual(
    values,
    sortedValues,
    `Objects should be sorted by '${options.field}'`,
  );
}
