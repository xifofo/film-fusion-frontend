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

  /** Ant Design Pro 默认规则 mock 数据 */
  type RuleListItem = {
    key: number;
    disabled?: boolean;
    href?: string;
    avatar?: string;
    name?: string;
    owner?: string;
    desc?: string;
    callNo?: number;
    status?: number;
    updatedAt?: string;
    createdAt?: string;
    progress?: number;
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
    link_type: "strm";  // 链接类型
    filter_rules?: string;      // JSON格式的文件扩展名过滤规则，如["mkv","mp4"]
    strm_content_type?: "openlist" | "path";  // STRM文件内容类型
    source_type?: "clouddrive2" | "moviepilot2";  // 源类型
    content_encode_uri?: boolean;  // 是否对内容进行URI编码
    created_at: string;
    updated_at: string;
    cloud_storage?: {           // 关联的云存储信息
      id: number;
      storage_name: string;
      storage_type: string;
    };
  };

  /** 目录配置 */
  type CloudDirectory = {
    id: number;
    user_id: number;
    cloud_storage_id: number;
    directory_name: string;
    directory_id: string;
    content_prefix?: string;
    content_encode_uri?: boolean;
    save_path?: string;
    include_extensions?: string;
    exclude_extensions?: string;
    exclude_smaller_than_mb?: number;
    classify_by_category?: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    cloud_storage?: {
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

  /** 扫描任务查询参数 */
  type ScanTaskQueryParams = PageParams & {
    status?: string;
    pathId?: number;
    keyword?: string;
  };

  /** 创建扫描任务参数 */
  type CreateScanTaskParams = {
    name: string;
    pathId: number;
  };

  /** Emby 封面模板元信息 */
  type EmbyCoverTemplate = {
    id: string;
    name: string;
  };

  /** Emby 媒体库（合并本地配置） */
  type EmbyCoverLibraryView = {
    /** Emby 侧媒体库 ID */
    emby_library_id: string;
    /** Emby 库名 */
    emby_name: string;
    /** movies / tvshows / boxsets 等 */
    collection_type: string;
    /** 中文主标，空表示未配置，将使用 emby_name */
    cn_title: string;
    /** 英文副标 */
    en_subtitle: string;
    /** 模板 ID */
    template_id: string;
    /** 是否参与批量生成 */
    enabled: boolean;
    /** 上次生成成功时间 */
    last_generated_at?: string | null;
    /** 上次错误信息 */
    last_error?: string;
    /** 本地是否存有配置记录 */
    configured: boolean;
  };

  /** SortName 单次 backfill 任务（运行中/已结束的统一形态） */
  type EmbySortNameJob = {
    id: string;
    library_ids: string[];
    /** true 时忽略 LockedFields 强制覆盖 */
    force: boolean;
    started_at: string;
    finished_at: string | null;
    running: boolean;
    total: number;
    updated: number;
    skipped: number;
    errors: number;
    error_msg?: string;
    duration_ms: number;
  };

  /** SortName 状态查询响应 */
  type EmbySortNameStatus = {
    running: boolean;
    job: EmbySortNameJob | null;
  };

  /** SortName 单 Item 处理结果 */
  type EmbySortNameItemResult = {
    item_id: string;
    name: string;
    action: 'updated' | 'skipped' | 'error';
    reason: string;
    new_sort: string;
    error?: string;
  };

  /** Emby 单个媒体库的电影 / 电视剧数量 */
  type EmbyLibraryStat = {
    emby_library_id: string;
    emby_name: string;
    /** movies / tvshows / mixed / homevideos / boxsets / music ... */
    collection_type: string;
    movie_count: number;
    series_count: number;
  };

  /** Emby 媒体库电影 / 电视剧统计快照 */
  type EmbyStats = {
    generated_at: string;
    total_libraries: number;
    total_movies: number;
    total_series: number;
    libraries: EmbyLibraryStat[];
    /** 部分库统计失败的提示信息（可降级展示） */
    partial_errors?: string[];
  };

  /** 上行：更新媒体库封面配置参数 */
  type UpsertEmbyCoverLibraryParams = {
    emby_name?: string;
    cn_title?: string;
    en_subtitle?: string;
    template_id?: string;
    enabled?: boolean;
  };

  /** Emby 代理 302 重定向日志条目 */
  type EmbyProxy302LogEntry = {
    id: number;
    timestamp: string;
    /** 来源标识：cache（命中缓存）/ proxyPlay（实时计算） */
    source: string;
    method: string;
    uri: string;
    user_agent: string;
    remote_ip: string;
    target: string;
    item_id?: string;
    media_source_id?: string;
    media_path?: string;
    match302_id?: number;
    assignment_id?: number;
    assigned_storage_id?: number;
    assigned_storage_name?: string;
    actual_storage_id?: number;
    actual_storage_name?: string;
    account_type?: 'source' | 'member' | string;
    balance_status?: string;
    fallback_reason?: string;
  };

  /** Emby 代理 302 重定向日志查询响应 */
  type EmbyProxy302LogList = {
    count: number;
    capacity: number;
    entries: EmbyProxy302LogEntry[];
  };

  type BalanceActivePlayback = {
    key: string;
    state: 'active' | 'recent';
    media_path: string;
    emby_item_id: string;
    media_source_id: string;
    remote_ip: string;
    user_agent: string;
    match302_id: number;
    assignment_id: number;
    assigned_storage_id: number;
    assigned_storage_name: string;
    actual_storage_id: number;
    actual_storage_name: string;
    account_type: string;
    status: string;
    fallback_reason?: string;
    last_request_at: string;
  };

  type BalanceAccountLoad = {
    match302_id: number;
    storage_id: number;
    storage_name: string;
    account_type: string;
    active_playbacks: number;
    max_active: number;
    cache_used_gb: number;
    cache_max_gb: number;
    total_assignments: number;
    ready_count: number;
    pending_count: number;
    transferring_count: number;
    failed_count: number;
    cooldown_until?: string;
    last_ready_at?: string;
    last_error_at?: string;
    last_error?: string;
  };

  type BalanceTransferQueueItem = {
    id: number;
    match302_id: number;
    media_path: string;
    source_storage_id: number;
    source_storage_name: string;
    target_storage_id: number;
    target_storage_name: string;
    status: string;
    attempts: number;
    last_error?: string;
    created_at: string;
    updated_at: string;
  };

  type BalanceTransferSummary = {
    pending: number;
    transferring: number;
    failed: number;
    queue: BalanceTransferQueueItem[];
  };

  type BalanceCleanupSummary = {
    cache_count: number;
    expiring_soon: number;
    cleanup_failed: number;
    last_cleaned_at?: string;
    by_account: Array<{
      storage_id: number;
      storage_name: string;
      count: number;
    }>;
  };

  type EmbyProxyBalanceStatus = {
    active_playbacks: BalanceActivePlayback[];
    account_loads: BalanceAccountLoad[];
    transfer_summary: BalanceTransferSummary;
    cleanup_summary: BalanceCleanupSummary;
    recent_fallbacks: EmbyProxy302LogEntry[];
    recent_events: EmbyProxy302LogEntry[];
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
    search?: string;
    order_by?: string;
    order_dir?: "asc" | "desc";
  };

  /** 目录配置查询参数 */
  type CloudDirectoryQueryParams = PageParams & {
    cloud_storage_id?: number;
    search?: string;
    order_by?: string;
    order_dir?: "asc" | "desc";
    page?: number;
    page_size?: number;
  };

  /** 创建云盘路径参数 */
  type CreateCloudPathParams = {
    cloud_storage_id: number;
    source_path: string;
    content_prefix?: string;
    local_path?: string;
    link_type: "strm";
    filter_rules?: string;
    strm_content_type?: "openlist" | "path";
    source_type?: "clouddrive2" | "moviepilot2";
    content_encode_uri?: boolean;
  };

  /** 创建目录配置参数 */
  type CreateCloudDirectoryParams = {
    cloud_storage_id: number;
    directory_name: string;
    directory_id: string;
    content_prefix?: string;
    content_encode_uri?: boolean;
    save_path?: string;
    include_extensions?: string;
    exclude_extensions?: string;
    exclude_smaller_than_mb?: number;
    classify_by_category?: boolean;
  };

  /** 更新云盘路径参数 */
  type UpdateCloudPathParams = {
    id: number;
    cloud_storage_id?: number;
    source_path?: string;
    content_prefix?: string;
    local_path?: string;
    link_type?: "strm";
    filter_rules?: string;
    strm_content_type?: "openlist" | "path";
    source_type?: "clouddrive2" | "moviepilot2";
    content_encode_uri?: boolean;
  };

  /** 更新目录配置参数 */
  type UpdateCloudDirectoryParams = {
    id: number;
    cloud_storage_id?: number;
    directory_name?: string;
    directory_id?: string;
    content_prefix?: string;
    content_encode_uri?: boolean;
    save_path?: string;
    include_extensions?: string;
    exclude_extensions?: string;
    exclude_smaller_than_mb?: number;
    classify_by_category?: boolean;
  };

  type Organize115CookieParams = {
    cloud_directory_id: number;
    folder_id?: string;
    folder_ids?: string[];
    file_ids?: string[];
    dry_run?: boolean;
    filename_regex_enabled?: boolean;
    filename_regex_pattern?: string;
    filename_regex_replacement?: string;
  };

  type Organize115DirDebug = {
    target_dir: string;
    existing_dir: string;
    existing_id: string;
    missing_dirs: string[];
    need_create: boolean;
    final_id: string;
    lookups?: Array<{
      path: string;
      id: string;
    }>;
  };

  type Organize115ItemResult = {
    file_id: string;
    file_name: string;
    file_size?: number;
    recognize_name?: string;
    pickcode?: string;
    media_type?: string;
    category?: string;
    tmdb_id?: string;
    title?: string;
    year?: string;
    title_year?: string;
    transfer_name?: string;
    target_path?: string;
    target_dir?: string;
    target_dir_id?: string;
    need_create?: boolean;
    missing_dirs?: string[];
    rename_to?: string;
    strm_path?: string;
    strm_content?: string;
    subtitle_queued?: boolean;
    subtitle_error?: string;
    local_dir?: string;
    local_exists?: boolean;
  };

  type Organize115CookieGroup = {
    folder_id: string;
    total: number;
    dir_debug?: Organize115DirDebug[];
    items?: Organize115ItemResult[];
    error?: string;
  };

  type Organize115CookieResult = {
    cloud_directory_id: number;
    cloud_storage_id: number;
    folder_id: string;
    folder_ids?: string[];
    dry_run: boolean;
    total: number;
    dir_debug?: Organize115DirDebug[];
    items?: Organize115ItemResult[];
    groups?: Organize115CookieGroup[];
  };

  /** 115 Cookie 目录请求参数 */
  type Cookie115DirRequest = {
    cloud_storage_id: number;
    cid?: string;
    offset?: number;
    limit?: number;
  };

  /** 115 Cookie 目录项（仅目录） */
  type Cookie115DirItem = {
    file_id: string;
    name: string;
    pick_code?: string;
    is_file: boolean;
  };

  /** 115 Cookie 目录响应 */
  type Cookie115DirResponse = {
    cloud_storage_id: number;
    cid: string;
    offset: number;
    limit: number;
    total: number;
    items: Cookie115DirItem[];
  };

  /** 批量操作参数 */
  type BatchCloudPathParams = {
    ids: number[];
    operation: "delete" | "sync" | "update";
    data?: {
      link_type?: "strm";
      strm_content_type?: "openlist" | "path";
      content_prefix?: string;
      filter_rules?: string;
      content_encode_uri?: boolean;
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
    content_encode_uri?: boolean;
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
    provider_uid?: string;
    app_id?: string;
    app_secret?: string;
    access_token?: string;
    refresh_token?: string;
    cookie?: string;
    token_expires_at?: string;
    refresh_expires_at?: string;
    last_refresh_at?: string;
    auto_refresh: boolean;
    refresh_before_min: number;
    status: 'active' | 'disabled' | 'error';
    error_message?: string;
    last_error_at?: string;
    config?: string;
    match302_max_active: number;
    match302_cache_max_gb: number;
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
    match302_max_active?: number;
    match302_cache_max_gb?: number;
    is_default?: boolean;
    sort_order?: number;
  };

  /** 更新云存储参数 */
  type UpdateCloudStorageParams = {
    id: number;
    storage_name?: string;
    app_id?: string;
    app_secret?: string;
    cookie?: string;
    auto_refresh?: boolean;
    refresh_before_min?: number;
    status?: 'active' | 'disabled' | 'error';
    config?: string;
    match302_max_active?: number;
    match302_cache_max_gb?: number;
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

  /** Pickcode 缓存记录 */
  type PickcodeCache = {
    id: number;
    file_path: string;
    pickcode: string;
    file_size?: number;
    mime_type?: string;
    created_at: string;
    updated_at: string;
  };

  /** Pickcode 缓存查询参数 */
  type PickcodeCacheQueryParams = PageParams & {
    search?: string;
    page?: number;
    size?: number;
  };

  /** 创建 Pickcode 缓存参数 */
  type CreatePickcodeCacheParams = {
    file_path: string;
    pickcode: string;
    file_size?: number;
    mime_type?: string;
  };

  /** 更新 Pickcode 缓存参数 */
  type UpdatePickcodeCacheParams = {
    id: number;
    file_path?: string;
    pickcode?: string;
    file_size?: number;
    mime_type?: string;
  };

  /** 批量删除 Pickcode 缓存参数 */
  type BatchDeletePickcodeCacheParams = {
    ids: number[];
  };

  /** Pickcode 缓存统计信息 */
  type PickcodeCacheStats = {
    total_count: number;
    total_size: number;
    latest_update: string;
  };

  /** Match302 重定向匹配配置 */
  type Match302BalanceMember = {
    id?: number;
    match302_id?: number;
    cloud_storage_id: number;
    enabled: boolean;
    weight: number;
    target_root_path?: string;
    last_error?: string;
    last_error_at?: string;
    cooldown_until?: string;
    cloud_storage?: {
      id: number;
      storage_name: string;
      storage_type: string;
    };
  };

  type Match302BalanceAssignment = {
    id: number;
    match302_id: number;
    emby_item_id?: string;
    media_source_id?: string;
    source_file_path: string;
    source_storage_id: number;
    playback_storage_id: number;
    is_source_playback: boolean;
    source_pickcode?: string;
    target_pickcode?: string;
    source_file_id?: string;
    target_file_id?: string;
    target_path?: string;
    sha1?: string;
    size: number;
    status: 'pending' | 'transferring' | 'ready' | 'failed' | string;
    attempts: number;
    last_error?: string;
    last_error_at?: string;
    last_ready_at?: string;
    last_played_at?: string;
    expires_at?: string;
    cleanup_status: 'none' | 'pending' | 'cleaning' | 'cleaned' | 'failed' | string;
    cleanup_error?: string;
    cleaned_at?: string;
    created_at: string;
    updated_at: string;
    source_storage?: {
      id: number;
      storage_name: string;
      storage_type: string;
    };
    playback_storage?: {
      id: number;
      storage_name: string;
      storage_type: string;
    };
  };

  type Match302 = {
    id: number;
    source_path: string;        // 源路径（最大500字符）
    target_path: string;        // 目标路径（最大500字符）
    cloud_storage_id: number;   // 云存储ID（外键）
    balance_enabled: boolean;
    balance_strategy: string;
    balance_limit_mode: 'loose' | 'strict' | string;
    source_weight: number;
    cleanup_enabled: boolean;
    retention_hours: number;
    cleanup_mode: string;
    cleanup_interval_min: number;
    min_keep_ready: number;
    created_at?: string;
    updated_at?: string;
    cloud_storage?: {           // 关联的云存储信息
      id: number;
      storage_name: string;
      storage_type: string;
    };
    pool_members?: Match302BalanceMember[];
  };

  /** Match302 查询参数 */
  type Match302QueryParams = PageParams & {
    source_path?: string;
    target_path?: string;
    cloud_storage_id?: number;
  };

  /** 创建 Match302 参数 */
  type CreateMatch302Params = {
    source_path: string;
    target_path: string;
    cloud_storage_id: number;
    balance_enabled?: boolean;
    balance_strategy?: string;
    balance_limit_mode?: 'loose' | 'strict' | string;
    source_weight?: number;
    cleanup_enabled?: boolean;
    retention_hours?: number;
    cleanup_mode?: string;
    cleanup_interval_min?: number;
    min_keep_ready?: number;
    pool_members?: Match302BalanceMember[];
  };

  /** 更新 Match302 参数 */
  type UpdateMatch302Params = {
    id: number;
    source_path?: string;
    target_path?: string;
    cloud_storage_id?: number;
    balance_enabled?: boolean;
    balance_strategy?: string;
    balance_limit_mode?: 'loose' | 'strict' | string;
    source_weight?: number;
    cleanup_enabled?: boolean;
    retention_hours?: number;
    cleanup_mode?: string;
    cleanup_interval_min?: number;
    min_keep_ready?: number;
    pool_members?: Match302BalanceMember[];
  };

  /** 整理日志记录 */
  type OrganizeLog = {
    id: number;
    action: string;             // strm_create / strm_delete / strm_rename / file_download / walk_dir
    status: string;             // success / skipped / failed
    trigger?: string;           // cd2_notify / mp2_notify / manual / download_worker / webhook
    source?: string;
    target?: string;
    cloud_path_id?: number;
    cloud_storage_id?: number;
    pick_code?: string;
    message?: string;
    error?: string;
    duration_ms?: number;
    size_bytes?: number;
    created_at: string;
    cloud_storage?: {
      id: number;
      storage_name: string;
      storage_type: string;
    };
  };

  /** 整理日志查询参数 */
  type OrganizeLogQueryParams = PageParams & {
    page?: number;
    size?: number;
    action?: string;
    status?: string;
    trigger?: string;
    cloud_path_id?: number;
    cloud_storage_id?: number;
    search?: string;
    start?: string;             // RFC3339
    end?: string;
  };

  /** 整理日志统计 */
  type OrganizeLogStats = {
    total: number;
    breakdown: { action: string; status: string; count: number }[];
    recent_24h: { action: string; status: string; count: number }[];
  };

  /** 清理整理日志参数 */
  type ClearOrganizeLogParams = {
    status?: string;
    action?: string;
    before_days?: number;
    confirm_all?: boolean;
  };
}
