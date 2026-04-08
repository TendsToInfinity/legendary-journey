import {
  NewElasticSearchPromiseClient,
  PromiseClient,
} from 'securus.libraries.elasticsearch-promise';
import { Inject } from 'typescript-ioc';
import { AppConfig } from '../utils/AppConfig';

export class EsClass {
  @Inject
  private config!: AppConfig;

  protected searchMaxResults: number = 10000;
  protected _host: string;
  protected _client: PromiseClient;

  constructor() {
    this._host = this.config.elastic;
    this._client = NewElasticSearchPromiseClient({ host: this._host });
  }
}
