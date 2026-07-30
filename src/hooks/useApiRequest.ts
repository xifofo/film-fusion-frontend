import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';

type AsyncService<TData, TParams extends unknown[]> = (
  ...params: TParams
) => Promise<TData>;

type UnwrapApiResponse<TData> = TData extends API.Response<infer TPayload>
  ? TPayload
  : TData;

type ApiRequestOptions<TData, TResult, TParams extends unknown[]> = {
  manual?: boolean;
  ready?: boolean;
  refreshDeps?: readonly unknown[];
  formatResult?: (data: TData) => TResult;
  onSuccess?: (data: TResult, params: TParams) => void;
  onError?: (error: Error, params: TParams) => void;
};

/**
 * TanStack Query adapter for the async calling convention used by the existing
 * pages. It keeps the migration focused on infrastructure while still moving
 * all request state out of Umi.
 */
export function useApiRequest<
  TData,
  TParams extends unknown[] = any[],
  TResult = UnwrapApiResponse<TData>,
>(
  service: AsyncService<TData, TParams>,
  options: ApiRequestOptions<TData, TResult, TParams> = {},
) {
  const requestId = useId();
  const { manual = false, ready = true, refreshDeps = [] } = options;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const transformResult = useCallback((rawData: TData): TResult => {
    const formatter = optionsRef.current.formatResult;
    if (formatter) {
      return formatter(rawData);
    }

    if (
      rawData &&
      typeof rawData === 'object' &&
      'code' in rawData &&
      'data' in rawData
    ) {
      return (rawData as unknown as API.Response<TResult>).data;
    }

    return rawData as unknown as TResult;
  }, []);

  const query = useQuery({
    queryKey: ['api-request', requestId, ...refreshDeps],
    queryFn: () => service(...([] as unknown as TParams)),
    enabled: !manual && ready,
    gcTime: 0,
  });

  const mutation = useMutation({
    mutationFn: (params: TParams) => service(...params),
    onSuccess: (rawData, params) => {
      optionsRef.current.onSuccess?.(transformResult(rawData), params);
    },
    onError: (error, params) => {
      optionsRef.current.onError?.(error, params);
    },
  });

  const queryData = useMemo(() => {
    if (query.data === undefined) return undefined;
    return transformResult(query.data);
  }, [query.data, transformResult]);

  const mutationData = useMemo(() => {
    if (mutation.data === undefined) return undefined;
    return transformResult(mutation.data);
  }, [mutation.data, transformResult]);

  const handledDataAt = useRef(0);
  useEffect(() => {
    if (
      manual ||
      query.dataUpdatedAt === 0 ||
      query.dataUpdatedAt <= handledDataAt.current
    ) {
      return;
    }
    handledDataAt.current = query.dataUpdatedAt;
    optionsRef.current.onSuccess?.(
      queryData as TResult,
      [] as unknown as TParams,
    );
  }, [manual, query.dataUpdatedAt, queryData]);

  const handledErrorAt = useRef(0);
  useEffect(() => {
    if (
      manual ||
      query.errorUpdatedAt === 0 ||
      query.errorUpdatedAt <= handledErrorAt.current
    ) {
      return;
    }
    handledErrorAt.current = query.errorUpdatedAt;
    if (query.error) {
      optionsRef.current.onError?.(query.error, [] as unknown as TParams);
    }
  }, [manual, query.error, query.errorUpdatedAt]);

  const runAsync = useCallback(
    (...params: TParams) => {
      return mutation.mutateAsync(params).then(transformResult);
    },
    [mutation.mutateAsync, transformResult],
  );

  const run = useCallback(
    (...params: TParams) => {
      void runAsync(...params).catch(() => undefined);
    },
    [runAsync],
  );

  const refresh = useCallback(async () => {
    const result = await query.refetch({ throwOnError: true });
    return result.data === undefined ? undefined : transformResult(result.data);
  }, [query.refetch, transformResult]);

  return {
    data: manual ? mutationData : queryData,
    error: manual ? mutation.error : query.error,
    loading: manual ? mutation.isPending : query.isFetching,
    refresh,
    run,
    runAsync,
  };
}
