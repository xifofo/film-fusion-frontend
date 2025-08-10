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
    user_id: number;
    cloud_storage_id: number;
    source_path: string;        // 云盘源路径
    content_prefix?: string;    // STRM内容前缀
    local_path?: string;        // 本地路径
    link_type: "strm" | "symlink";  // 链接类型
    filter_rules?: string;      // JSON格式的文件扩展名过滤规则，如["mkv","mp4"]
    strm_content_type?: "openlist" | "path";  // STRM文件内容类型
    source_type?: "clouddrive2" | "moviepilot2";  // 源类型
    is_windows_path?: boolean;  // 是否为Windows路径格式
    created_at: string;
    updated_at: string;
    cloud_storage?: {           // 关联的云存储信息
      id: number;
      storage_name: string;
      storage_type: string;
    };
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
    cloud_storage_id?: number;
    source_path?: string;
    local_path?: string;
    link_type?: "strm" | "symlink";
    strm_content_type?: "openlist" | "path";
    source_type?: "clouddrive2" | "moviepilot2";
    is_windows_path?: boolean;
    search?: string;
    order_by?: string;
    order_dir?: "asc" | "desc";
  };

  /** 创建云盘路径参数 */
  type CreateCloudPathParams = {
    cloud_storage_id: number;
    source_path: string;
    content_prefix?: string;
    local_path?: string;
    link_type: "strm" | "symlink";
    filter_rules?: string;
    strm_content_type?: "openlist" | "path";
    source_type?: "clouddrive2" | "moviepilot2";
    is_windows_path?: boolean;
  };

  /** 更新云盘路径参数 */
  type UpdateCloudPathParams = {
    id: number;
    cloud_storage_id?: number;
    source_path?: string;
    content_prefix?: string;
    local_path?: string;
    link_type?: "strm" | "symlink";
    filter_rules?: string;
    strm_content_type?: "openlist" | "path";
    source_type?: "clouddrive2" | "moviepilot2";
    is_windows_path?: boolean;
  };

  /** 批量操作参数 */
  type BatchCloudPathParams = {
    ids: number[];
    operation: "delete" | "sync" | "update";
    data?: {
      link_type?: "strm" | "symlink";
      strm_content_type?: "openlist" | "path";
      content_prefix?: string;
      filter_rules?: string;
      is_windows_path?: boolean;
    };
  };

  /** 批量操作响应 */
  type BatchOperationResult = {
    success_count: number;
    error_count: number;
    errors: string[];
  };

  /** 链接类型选项 */
  type LinkTypeOption = {
    value: "strm" | "symlink";
    label: string;
    desc: string;
  };

  /** STRM内容类型选项 */
  type StrmContentTypeOption = {
    value: "openlist" | "path";
    label: string;
    desc: string;
  };

  /** 路径验证参数 */
  type ValidateCloudPathParams = {
    cloud_storage_id: number;
    source_path: string;
    content_prefix?: string;
    local_path?: string;
    link_type: "strm" | "symlink";
    filter_rules?: string;
    strm_content_type?: "openlist" | "path";
    is_windows_path?: boolean;
  };

  /** 路径验证结果 */
  type ValidateCloudPathResult = {
    valid: boolean;
    cloud_storage: string;
    link_type_valid: boolean;
    source_path: string;
    local_path: string;
    strm_content_type_valid: boolean;
  };

  /** 路径统计信息 */
  type CloudPathStatistics = {
    total_paths: number;
    strm_paths: number;
    symlink_paths: number;
    by_storage_type: Array<{
      storage_type: string;
      storage_name: string;
      count: number;
    }>;
    recently_created: CloudPath[];
  };

  /** 导出数据 */
  type ExportCloudPathData = {
    version: string;
    exported_at: string;
    paths: CloudPath[];
  };

  /** 导入参数 */
  type ImportCloudPathParams = {
    paths: CreateCloudPathParams[];
    replace_existing: boolean;
  };

  /** 导入结果 */
  type ImportCloudPathResult = {
    success_count: number;
    error_count: number;
    errors: string[];
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

  /** 替换 STRM 内容参数（仅当 CloudPath.link_type 为 "strm" 时有效） */
  type ReplaceStrmContentParams = {
    /** 要被替换的子串 */
    from: string;
    /** 替换成的子串 */
    to: string;
  };
}
