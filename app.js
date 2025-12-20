App({
  onLaunch: function () {
    // 1. 云能力初始化（全局只加载一次）
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        traceUser: true,
      })
    }

    // 2. 动态加载字体（全局只加载一次）
    // 因为设置了 global: true，字体加载成功后全小程序通用，不需要在 Page 里面重复加载
    wx.loadFontFace({
      global: true, 
      family: 'CustomFont',
      source: 'url("https://636c-cloud1-7gvskpoo2a3897dc-1392473051.tcb.qcloud.la/fonts/ziyueyinyingsong-s-Regular.woff2")',
      success(res) {
        console.log('字体初始化成功', res.status)
      },
      fail: function (res) {
        console.error('字体初始化失败', res)
      }
    })

    // 3. 获取系统信息（如果需要，也建议放在这里执行一次，存入 globalData）
    const windowInfo = wx.getWindowInfo();
    this.globalData = {
      windowInfo: windowInfo // 存入全局变量供所有页面直接使用
    }
  },

  // 确保全局变量初始化为空对象
  globalData: {}
})