import {
  FindOptions,
  FindResult,
  ValidId,
} from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { Singleton } from 'typescript-ioc';
import { Paginated } from '../lib/models/Paginated';

@Singleton
export class SearchHelper {
  public buildPaginationOptions(source: {
    [key: string]: string;
  }): FindOptions<never, never> {
    return {
      pageNumber: this.parseNumber(source.pageNumber, 0),
      pageSize: this.parseNumber(source.pageSize, 25),
      total: _.isEqual(source.total, 'true'),
      orderBy: this.buildOrderBy(source.orderBy),
    };
  }

  public buildResponse<Model extends object, Id extends ValidId>(
    result: FindResult<Model>,
    findOptions: FindOptions<Model, Id>,
  ): Paginated<Model> {
    // Handle both cases Model[] | [Model[], number]
    return {
      data: (_.isArray(result[0]) ? result[0] : result) as Model[],
      pageNumber: findOptions.pageNumber,
      pageSize: findOptions.pageSize,
      total:
        findOptions.total && _.isArray(result[0])
          ? (result[1] as any)
          : findOptions.total && !_.isArray(result[0])
            ? result.length
            : undefined,
    };
  }

  private parseNumber(input: any, defaultValue: number) {
    const result = _.toNumber(input);
    return _.isNaN(result) ? defaultValue : result;
  }

  // TODO: Handle invalid input better.
  private buildOrderBy(
    orderByString: string,
  ): { [field: string]: 'ASC' | 'DESC' } | undefined {
    if (_.isEmpty(orderByString)) {
      return undefined;
    }
    const [field, direction] = orderByString.split(':');
    return {
      [field]: _.toUpper(direction) === 'ASC' ? 'ASC' : 'DESC',
    };
  }
}
