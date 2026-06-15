import { Empty } from 'antd';
import React, { useState } from 'react';
import { embyWatchImageUrl } from '@/services/film-fusion';

/** Emby 海报缩略图（经后端代理加载，加载失败时回退占位）
 *  - 默认固定 width/height
 *  - fill=true 时撑满父容器并保持 2:3 海报比例（用于海报墙） */
export const Poster: React.FC<{
  itemId?: string;
  width?: number;
  height?: number;
  radius?: number;
  maxWidth?: number;
  alt?: string;
  fill?: boolean;
}> = ({
  itemId,
  width = 40,
  height = 60,
  radius = 4,
  maxWidth = 200,
  alt,
  fill = false,
}) => {
  const [failed, setFailed] = useState(false);
  const url = embyWatchImageUrl(itemId, maxWidth);

  if (fill) {
    const base: React.CSSProperties = {
      width: '100%',
      aspectRatio: '2 / 3',
      borderRadius: radius,
      display: 'block',
    };
    if (!itemId || !url || failed) {
      return (
        <div
          style={{
            ...base,
            background: 'linear-gradient(135deg, #e6e6e6, #f5f5f5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#bbb',
            fontSize: 36,
          }}
        >
          🎬
        </div>
      );
    }
    return (
      <img
        src={url}
        alt={alt || ''}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ ...base, objectFit: 'cover', background: '#f0f0f0' }}
      />
    );
  }

  const placeholder = (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(135deg, #e6e6e6, #f5f5f5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#bbb',
        fontSize: Math.min(width, height) * 0.4,
        flex: 'none',
      }}
    >
      🎬
    </div>
  );
  if (!itemId || !url || failed) return placeholder;
  return (
    <img
      src={url}
      alt={alt || ''}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{
        width,
        height,
        borderRadius: radius,
        objectFit: 'cover',
        flex: 'none',
        background: '#f0f0f0',
      }}
    />
  );
};

/** 分钟数转 "X 小时 Y 分" 友好展示 */
export const formatMinutes = (minutes?: number): string => {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h <= 0) return `${rest} 分钟`;
  if (rest === 0) return `${h} 小时`;
  return `${h} 小时 ${rest} 分`;
};

/** 月度观看条形图（纯 div，无需图表库） */
export const MonthlyBars: React.FC<{
  data: API.EmbyWatchMonthCount[];
}> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
    );
  }
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        height: 160,
        overflowX: 'auto',
        paddingTop: 8,
      }}
    >
      {data.map((d) => {
        const h = Math.round((d.total / max) * 120);
        return (
          <div
            key={d.month}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 36,
            }}
          >
            <span style={{ fontSize: 12, color: '#555' }}>{d.total}</span>
            <div
              style={{
                width: 24,
                height: Math.max(h, 2),
                background: 'linear-gradient(180deg, #69b1ff, #1677ff)',
                borderRadius: 4,
              }}
            />
            <span style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {d.month.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 电影 / 剧集 占比环形图（纯 CSS conic-gradient，无图表库） */
export const TypeRatioDonut: React.FC<{
  movie: number;
  episode: number;
}> = ({ movie, episode }) => {
  const total = (movie || 0) + (episode || 0);
  if (total <= 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
    );
  }
  const moviePct = Math.round((movie / total) * 100);
  const movieDeg = (movie / total) * 360;
  const legend = (color: string, label: string, value: number, pct: number) => (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          display: 'inline-block',
        }}
      />
      <span style={{ color: '#555' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 500 }}>
        {value} · {pct}%
      </span>
    </div>
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `conic-gradient(#1677ff 0deg ${movieDeg}deg, #52c41a ${movieDeg}deg 360deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 600 }}>{total}</span>
          <span style={{ fontSize: 12, color: '#888' }}>总条目</span>
        </div>
      </div>
      <div style={{ minWidth: 180, flex: 1 }}>
        {legend('#1677ff', '电影', movie || 0, moviePct)}
        {legend('#52c41a', '剧集(集)', episode || 0, 100 - moviePct)}
      </div>
    </div>
  );
};

/** 时段（24 小时）观看分布条形图 */
export const HourlyBars: React.FC<{
  data: { hour: number; total: number }[];
}> = ({ data }) => {
  const map = new Map<number, number>();
  (data || []).forEach((d) => map.set(d.hour, d.total));
  const series = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: map.get(h) || 0,
  }));
  const max = Math.max(...series.map((s) => s.total), 1);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        height: 140,
        paddingTop: 8,
      }}
    >
      {series.map((s) => {
        const h = Math.round((s.total / max) * 110);
        return (
          <div
            key={s.hour}
            title={`${s.hour}:00 — ${s.total} 次`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
            }}
          >
            <div
              style={{
                width: '70%',
                height: Math.max(h, 2),
                background: 'linear-gradient(180deg, #ffd666, #fa8c16)',
                borderRadius: 3,
              }}
            />
            {s.hour % 3 === 0 && (
              <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                {s.hour}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 星期分布条形图 */
export const WeekdayBars: React.FC<{
  data: { weekday: number; total: number }[];
}> = ({ data }) => {
  const map = new Map<number, number>();
  (data || []).forEach((d) => map.set(d.weekday, d.total));
  const series = WEEKDAY_LABELS.map((label, idx) => ({
    label,
    total: map.get(idx) || 0,
  }));
  const max = Math.max(...series.map((s) => s.total), 1);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        height: 160,
        paddingTop: 8,
      }}
    >
      {series.map((s) => {
        const h = Math.round((s.total / max) * 120);
        return (
          <div
            key={s.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
            }}
          >
            <span style={{ fontSize: 12, color: '#555' }}>{s.total}</span>
            <div
              style={{
                width: '60%',
                height: Math.max(h, 2),
                background: 'linear-gradient(180deg, #95de64, #52c41a)',
                borderRadius: 4,
              }}
            />
            <span style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
