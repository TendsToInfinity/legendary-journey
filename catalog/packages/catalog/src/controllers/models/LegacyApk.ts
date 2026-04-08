/**
 * @tsoaModel
 */
export interface LegacyApk {
  id: string;
  packageName: string;
  category: string;
  name: string;
  description: string;
  isSystemApp: boolean;
  isPrivileged: boolean;
  postInstallCommand: string;
  allowAppManagement: boolean;
}
