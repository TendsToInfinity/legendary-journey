import { _ } from '@securustablets/libraries.utils';
import { Logger } from 'securus.tablets.models.common';
import * as sinon from 'sinon';
import { AppConfig } from '../../src/utils/AppConfig';

export class MockUtils {
  public static inject(
    instance: any,
    propertyName: string,
    constructor?: any,
  ): sinon.SinonMock {
    if (!constructor) {
      constructor = Reflect.getMetadata('design:type', instance, propertyName);
    }
    return sinon.mock(
      (instance[propertyName] = MockUtils.createStub(constructor)),
    );
  }

  public static injectConfig(
    instance: any,
    propertyName: string = 'config',
  ): sinon.SinonMock {
    return sinon.mock(
      (instance[propertyName] = {
        get: MockUtils.defaultImplementation(AppConfig, 'get', {
          throwError: true,
        }),
      }),
    );
  }

  public static injectLogger(
    instance: any,
    propertyName: string = 'log',
  ): sinon.SinonMock {
    return sinon.mock(
      (instance[propertyName] = {
        debug: MockUtils.defaultImplementation(Logger, 'debug'),
        info: MockUtils.defaultImplementation(Logger, 'info'),
        notice: MockUtils.defaultImplementation(Logger, 'notice'),
        warning: MockUtils.defaultImplementation(Logger, 'warning'),
        error: MockUtils.defaultImplementation(Logger, 'error'),
        critical: MockUtils.defaultImplementation(Logger, 'critical'),
        alert: MockUtils.defaultImplementation(Logger, 'alert'),
        emergency: MockUtils.defaultImplementation(Logger, 'emergency'),
      }),
    );
  }

  public static createStub(constructor: any): any {
    const propertyDescriptors: PropertyDescriptorMap = _.fromPairs(
      Object.getOwnPropertyNames(constructor.prototype).map((propName) => {
        const propertyDescriptor = Object.getOwnPropertyDescriptor(
          constructor.prototype,
          propName,
        )!;
        return 'value' in propertyDescriptor &&
          'constructor' !== propName &&
          _.isFunction(propertyDescriptor.value)
          ? [
              propName,
              {
                value: MockUtils.defaultImplementation(constructor, propName, {
                  throwError: true,
                }),
                writable: true,
              },
            ]
          : [propName, propertyDescriptor];
      }),
    ) as any;
    return Object.create(null, propertyDescriptors);
  }

  private static defaultImplementation(
    constructor: any,
    propertyName: string,
    options?: { throwError?: boolean },
  ): () => void {
    return _.get(options, 'throwError')
      ? () => {
          throw Error(
            `No behavior defined for ${constructor.name}.${propertyName}()`,
          );
        }
      : () => null;
  }
}
