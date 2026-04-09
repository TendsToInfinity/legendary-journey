/**
 * Create by revji on 3/9/2018
 */
import { LegacyApk } from './LegacyApk';
import { TabletPackageFilter } from './TabletPackageFilter';

/**
 * Duplicated into TabletPackageSchema
 * to fix reference issues
 */
export enum PackageType {
  Personal = 'personal',
  Officer = 'officer',
  Community = 'community',
  Pool = 'pool',
  Warehouse = 'warehouse',
  Inventory = 'inventory',
}

/**
 * @tsoaModel
 */
export interface Package {
  name: string;
  id: string;
  price: number;
  description: string;
  applications: LegacyApk[];
  demo: boolean;
  modelNumber: string;
  type: PackageType;
  deviceFeatures: string[];
  filters: TabletPackageFilter;
  webViews?: number[];
}

/**
 * @tsoaModel
 */
export interface PackageIds {
  packageIds: string[];
}
