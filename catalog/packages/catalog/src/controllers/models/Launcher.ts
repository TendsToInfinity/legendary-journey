export interface Launcher {
  workspace: WorkspaceItem[];
}

// Currently, only shortcuts and widgets and supported;
export interface WorkspaceItem {
  type: WorkspaceItemType;
  packageName: string; // androidClass from IApplication
}

export enum WorkspaceItemType {
  Widget = 'widget',
  Shortcut = 'shortcut',
}
