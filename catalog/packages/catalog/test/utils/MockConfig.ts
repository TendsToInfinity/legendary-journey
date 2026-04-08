import { Config } from 'securus.tablets.models.common';

export class MockConfig implements Config {
  private _config: { [key: string]: any };

  constructor() {
    this._config = {};
  }

  public get<T>(key: string): T {
    return this._config[key];
  }

  public has(key: string): boolean {
    return this._config[key] !== undefined;
  }

  public add(key: string, value: string) {
    this._config[key] = value;
  }

  public remove(key: string) {
    delete this._config[key];
  }
}
