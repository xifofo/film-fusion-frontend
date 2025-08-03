declare namespace API {
  /** 用户信息 */
  type User = {
    id: number;
    username: string;
    email?: string;
    avatar?: string;
    createTime?: string;
    updateTime?: string;
  };

  /** 媒体文件信息 */
  type Media = {
    id: number;
    title: string;
    originalTitle?: string;
    year?: number;
    type: 'movie' | 'tv' | 'anime';
    genre?: string[];
    rating?: number;
    overview?: string;
    poster?: string;
    backdrop?: string;
    filePath: string;
    fileSize: number;
    duration?: number;
    resolution?: string;
    createTime: string;
    updateTime: string;
  };

  /** 云盘路径配置 */
  type CloudPath = {
    id: number;
    name: string;
    path: string;
    type: 'local' | 'webdav' | 'alist';
    config?: Record<string, any>;
    isActive: boolean;
    createTime: string;
    updateTime: string;
  };

  /** 扫描任务 */
  type ScanTask = {
    id: number;
    name: string;
    pathId: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    totalFiles: number;
    processedFiles: number;
    createTime: string;
    updateTime: string;
  };

  /** 通用响应结构 */
  type Response<T = any> = {
    code: number;
    message: string;
    data: T;
  };

  /** 分页参数 */
  type PageParams = {
    current?: number;
    pageSize?: number;
  };

  /** 分页响应 */
  type PageResult<T = any> = {
    list: T[];
    total: number;
    current: number;
    pageSize: number;
  };

  /** 登录参数 */
  type LoginParams = {
    username: string;
    password: string;
    autoLogin?: boolean;
  };

  /** 登录响应 */
  type LoginResult = {
    token: string;
    user: User;
    expireAt: number;
  };

  /** 媒体查询参数 */
  type MediaQueryParams = PageParams & {
    title?: string;
    type?: string;
    genre?: string;
    year?: number;
    rating?: number;
  };

  /** 云盘路径查询参数 */
  type CloudPathQueryParams = PageParams & {
    name?: string;
    type?: string;
    isActive?: boolean;
  };

  /** 创建云盘路径参数 */
  type CreateCloudPathParams = {
    name: string;
    path: string;
    type: 'local' | 'webdav' | 'alist';
    config?: Record<string, any>;
  };

  /** 扫描任务查询参数 */
  type ScanTaskQueryParams = PageParams & {
    status?: string;
    pathId?: number;
  };

  /** 创建扫描任务参数 */
  type CreateScanTaskParams = {
    name: string;
    pathId: number;
  };

  /** 云存储配置 */
  type CloudStorage = {
    id: number;
    user_id: number;
    storage_type: string;
    storage_name: string;
    app_id?: string;
    app_secret?: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: string;
    refresh_expires_at?: string;
    last_refresh_at?: string;
    auto_refresh: boolean;
    refresh_before_min: number;
    status: 'active' | 'disabled' | 'error';
    error_message?: string;
    last_error_at?: string;
    config?: string;
    is_default: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    user?: User;
  };

  /** 云存储查询参数 */
  type CloudStorageQueryParams = PageParams & {
    storage_name?: string;
    storage_type?: string;
    status?: string;
    is_default?: boolean;
  };

  /** 创建云存储参数 */
  type CreateCloudStorageParams = {
    storage_type: string;
    storage_name: string;
    app_id?: string;
    app_secret?: string;
    auto_refresh?: boolean;
    refresh_before_min?: number;
    config?: string;
    is_default?: boolean;
    sort_order?: number;
  };

  /** 更新云存储参数 */
  type UpdateCloudStorageParams = {
    id: number;
    storage_name?: string;
    app_id?: string;
    app_secret?: string;
    auto_refresh?: boolean;
    refresh_before_min?: number;
    status?: 'active' | 'disabled' | 'error';
    config?: string;
    is_default?: boolean;
    sort_order?: number;
  };
}
