import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { SpLite } from '@securustablets/libraries.json-schema/dist/src/models/SpLite';
import { Logger } from '@securustablets/libraries.logging';
import { _ } from '@securustablets/libraries.utils';
import { Schema } from 'jsonschema';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { AppConfig } from '../utils/AppConfig';

export interface Clauses {
  [key: string]: any[];
}

// TODO replace useless arrays with bool abd string
export interface UpdatedSearchClauses {
  isArray: [boolean];
  key: string[];
  value: any[];
}
export type ClauseEntry = [string, any[]];
export type Match = object;

@Singleton
export class ClauseConverter {
  @Inject
  private log!: Logger;

  /**
   * Converts api clauses to postgres-friendly jsonb match.
   *
   * e.g.
   * {'meta.rating': ['PG', 'PG-13']} => [{meta: {rating: 'PG'}}, {meta: {rating: 'PG-13'}}]
   * See tests for more complex examples.
   */
  public convertTo(clauses: Clauses | ClauseEntry[], schema: SpLite): Match[] {
    if (_.isEmpty(clauses)) {
      return [];
    }

    const clauseEntries = _.isArray(clauses) ? clauses : _.entries(clauses);
    const headMatches = this.buildMatches(_.head(clauseEntries), schema);
    const tailMatches = this.convertTo(_.tail(clauseEntries), schema);

    return _.flatMap(_.castArray(headMatches), (headMatch) => {
      // Make sure we always have at least 1 clause to merge with.
      const baseMatches = _.isEmpty(tailMatches) ? [{}] : tailMatches;
      return baseMatches.map((baseMatch) => _.merge({}, headMatch, baseMatch));
    });
  }

  private buildMatches([path, values]: ClauseEntry, schema: SpLite): Match[] {
    const { typedPath } = new JsonSchemaParser(schema).getSchema(path);

    // Converts to a path we can use with _.set() in order to build a `Match` object.
    // e.g.
    // * meta.genres     -> meta.genres[0]
    // * meta.cast.name  -> meta.cast[0].name
    // * meta.cast.roles -> meta.cast[0].roles[0]
    const propertyPath = typedPath
      .split('.')
      .map((pathComponent) => {
        const [propertyName, type] = pathComponent.split('|');
        if (propertyName === 'SCHEMA') {
          return '';
        }
        if (type === 'array') {
          return `${propertyName}[0]`;
        }
        return propertyName;
      })
      .filter((pathComponent) => !_.isEmpty(pathComponent))
      .join('.');

    return _.map(_.castArray(values), (value) =>
      _.set({}, propertyPath, value),
    );
  }

  /**
   * Converts postgres-friendly jsonb match to api clauses.
   *
   * e.g.
   * [{meta: {rating: 'PG'}}, {meta: {rating: 'PG-13'}}] => {'meta.rating': ['PG', 'PG-13']}
   * e.g. when isSearchConvert = true
   * [{meta: {rating: 'PG'}}, {meta: {rating: 'PG-13'}}] => {'meta.rating': ['PG', 'PG-13']}
   * [{meta: {cast: [{name: 'cast name', roles: ['DIRECTOR']}]}}] => {'meta.cast': [{name: 'cast name', roles: ['DIRECTOR']}]}
   * See tests for more complex examples.
   */
  public convertFrom(matches: Match[], expandArrays = true): Clauses {
    if (_.isEmpty(matches)) {
      return {};
    }

    const headClauses = this.buildClauses(_.head(matches), '', expandArrays);
    const tailClauses = this.convertFrom(_.tail(matches), expandArrays);

    return _.entries(tailClauses).reduce((allClauses, [path, value]) => {
      const existingValue = _.get(allClauses, path);
      return {
        ...allClauses,
        [path]: _.union(_.castArray(existingValue), _.castArray(value)),
      };
    }, headClauses);
  }

  private buildClauses(match: Match, prefix, expandArrays: boolean): Clauses {
    return _.entries(match).reduce((clauses, [key, value]) => {
      if (_.isPlainObject(value)) {
        return {
          ...clauses,
          ...this.buildClauses(value, `${prefix}${key}.`, expandArrays),
        };
      } else if (expandArrays && _.isArray(value) && _.isObject(value[0])) {
        return {
          ...clauses,
          ...this.buildClauses(value[0], `${prefix}${key}.`, expandArrays),
        };
      } else {
        return { ...clauses, [`${prefix}${key}`]: _.castArray(value) };
      }
    }, {});
  }

  /**
   * converts the matches to an object to be used in postgres where condition
   * @param matches - array of Match Object
   * @param jsonSchema - schema of the productType
   * @param productTypeId - the productTypeId
   * @returns array of clauses
   *
   * e.g
   * matches = [{meta: {rating: 'PG'}}, {source: {vendorName: 'swank'}}], album jsonschema and ProductTypeId = 'album'
   * returns [{isArray: [true], key: ['meta.rating'], value: [['PG']]}, {isArray: [false], key: ['source.vendorName'], value: ['swank']}]
   * See tests for more complex examples.
   */
  public async convertToWhereClauses(
    matches: Match[],
    jsonSchema: Schema,
    productTypeId: string,
  ): Promise<UpdatedSearchClauses[]> {
    const clauses = this.convertFrom(matches, false);

    if (_.isEmpty(clauses)) {
      return [];
    }
    const whereObject: UpdatedSearchClauses[] = [];
    for (const [key, value] of Object.entries(clauses)) {
      const isSchemaFieldTypeArray = await this.getJsonSchemaByFieldNameIsArray(
        jsonSchema,
        key,
        productTypeId,
      );
      whereObject.push({
        isArray: [isSchemaFieldTypeArray],
        key: [key],
        value: [value],
      });
    }

    return whereObject;
  }

  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
  })
  private async getJsonSchemaByFieldNameIsArray(
    productTypeJsonSchema: any,
    fieldName: string,
    productTypeId: string,
  ): Promise<boolean> {
    const jsp = new JsonSchemaParser(productTypeJsonSchema);
    try {
      const schema = jsp.getSchema(fieldName);
      return schema.typedPath.split('|').includes('array');
    } catch (err) {
      this.log.notice(
        `Received an error looking up for field - ${fieldName} in the productType - ${productTypeId}`,
        err,
      );
      return false;
    }
  }
}

export interface Rules {
  productTypeId: string;
  [key: string]: any;
}
