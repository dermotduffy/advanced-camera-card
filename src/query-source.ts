export enum QuerySource {
  // Camera queries are handled by CameraManager.
  Camera = 'camera',

  // Folder queries are handled by FolderManager.
  Folder = 'folder',
}

export interface BaseQuery {
  source: QuerySource;
}
