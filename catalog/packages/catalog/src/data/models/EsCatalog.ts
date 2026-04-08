/**
 * Created by revji on 7/28/2017.
 */

export interface EsPackage {
  _id?: string;
  _version?: number;
  price: number;
  name: string;
  description: string;
  bundleIds: string[];
  demo: boolean;
  filter?: EsPackageFilter;
  udate?: string;
  cdate?: string;
}

export interface EsPackageFilter {
  stype?: string[];
  customerId?: string[];
  siteId?: string[];
  hardwareType?: string[];
  channel?: string[];
  [key: string]: any;
}

export interface EsBundle {
  _id?: string;
  _version?: number;
  applications: EsBundleApplication[];
  name: string;
  udate?: string;
  cdate?: string;
}

export interface EsBundleApplication {
  applicationId: string;
  enabled: boolean;
}

export interface EsApplication {
  _id?: string;
  _version?: number;
  md5?: string;
  category: string;
  description?: string;
  isPrivileged: boolean; // install with root privs
  isSystemApp: boolean; // never allow uninstall/disable
  allowAppManagement: boolean; // allow bmod and appAvailability
  postInstallCommand: string;
  name: string; // Friendly display name
  androidClass: string; // android class name
  udate?: string;
  cdate?: string;
}
