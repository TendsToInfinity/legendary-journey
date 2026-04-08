import { EsClass } from './EsClass';

export class ESCatalogRepository extends EsClass {
  protected _index: string;
  protected _types: any;

  public static readonly INDEX = 'sv_catalog';
  public static readonly TYPES = {
    APPLICATION_CONFIG: 'application_config',
  };

  constructor() {
    super();
    this._index = ESCatalogRepository.INDEX;
    this._types = {
      application_config: ESCatalogRepository.TYPES.APPLICATION_CONFIG,
    };
  }
}
