// 115网盘授权相关mock数据
export default {
  // 获取授权二维码
  'POST /api/auth/115/qrcode': (req: any, res: any) => {
    const { client_id, name } = req.body;

    if (!client_id || !name) {
      return res.json({
        code: 1001,
        message: '缺少必要参数',
        data: null
      });
    }

    // 模拟生成二维码数据和会话ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const qrCodeData = `https://115.com/web/oauth/authorize?client_id=${client_id}&session_id=${sessionId}&response_type=code&scope=basic`;

    res.json({
      code: 0,
      message: '二维码生成成功',
      data: {
        qr_code_data: qrCodeData,
        session_id: sessionId
      }
    });
  },

  // 检查授权状态
  'POST /api/auth/115/status': (req: any, res: any) => {
    const { session_id } = req.body;

    if (!session_id) {
      return res.json({
        code: 1002,
        message: '缺少会话ID',
        data: null
      });
    }

    // 模拟不同的授权状态
    // 在实际使用中，这里会根据session_id查询真实的授权状态
    const now = Date.now();
    const sessionTime = parseInt(session_id.split('_')[1]);
    const elapsed = now - sessionTime;

    let status = 0;
    let message = '等待扫码';

    if (elapsed > 10000 && elapsed < 20000) {
      // 10-20秒后模拟扫码成功
      status = 1;
      message = '扫码成功，等待确认';
    } else if (elapsed >= 20000 && elapsed < 300000) {
      // 20秒后模拟登录成功
      status = 2;
      message = '确认登录成功';
    } else if (elapsed >= 300000) {
      // 5分钟后模拟超时取消
      status = -2;
      message = '已取消登录';
    }

    res.json({
      code: 0,
      message,
      data: {
        status
      }
    });
  },

  // 完成授权
  'POST /api/auth/115/complete': (req: any, res: any) => {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: '缺少会话ID'
      });
    }

    // 模拟完成授权并返回存储信息
    const storageId = Math.floor(Math.random() * 1000) + 1;

    res.json({
      message: '授权完成，配置已保存',
      storage_id: storageId,
      access_token: 'access_token_***_hidden',
      refresh_token: 'refresh_token_***_hidden',
      expires_in: 7200
    });
  }
};
