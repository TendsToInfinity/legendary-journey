import { _ } from '@securustablets/libraries.utils';
import { GetParams } from 'elasticsearch';
import { Launcher } from '../../controllers/models/Launcher';
import { ESCatalogRepository } from '../ESCatalogRepository';

export class ApplicationConfigDao extends ESCatalogRepository {
  private static LAUNCHER_APP_ID = 'net.securustech.sv.launcher';

  // Launcher is configured at the provider level for now. We use one
  // document to configure every tablet for every customer.
  //
  // This means that there may be apps returned here that are not present
  // for certain tablets.
  public async getLauncherConfig(
    defaultWorkspace?: boolean,
  ): Promise<Launcher> {
    const lConfig = { workspace: [] };
    if (defaultWorkspace) {
      return lConfig;
    }
    return this.getConfig(ApplicationConfigDao.LAUNCHER_APP_ID)
      .then((launcherConfig) => {
        // Do not require the configuration to exist.
        return _.merge(lConfig, launcherConfig);
      })
      .catch(() => {
        return lConfig;
      });
  }

  private getConfig(appId: string): Promise<any> {
    const tParams: GetParams = {
      index: this._index,
      type: this._types.application_config,
      id: appId,
    };
    return this._client.getAsync(tParams).then((result) => {
      const appConfig = <any>result._source;
      appConfig._id = result._id;
      return appConfig;
    });
  }
}
