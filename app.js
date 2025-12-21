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

    // 2. 动态加载字体
    // 【说明】之前的字体链接 (ziyueyinyingsong) 已失效，导致控制台报错。
    // 我先将其注释掉以消除错误。
    // 如果你需要恢复特殊字体，请在云开发控制台重新上传字体文件，获取新的 HTTP 链接，
    // 然后取消下方的注释，并将 source 中的 url 替换为新链接。
    
    /* wx.loadFontFace({
      global: true, 
      family: 'CustomFont',
      source: 'url("https://636c-cloud1-7gvskpoo2a3897dc-1392473051.tcb.qcloud.la/fonts/ziyueyinyingsong-s-Regular.woff2")',
      success(res) {
        console.log('字体初始化成功', res.status)
      },
      fail: function (res) {
        // 这里的报错已经被注释掉了，不会再烦你了
        console.error('字体初始化失败', res)
      }
    })
    */

    // 3. 获取系统信息（如果需要，也建议放在这里执行一次，存入 globalData）
    // 注意：wx.getWindowInfo 需要基础库版本支持，如果报错请改回 wx.getSystemInfoSync()
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    
    this.globalData = {
      windowInfo: windowInfo // 存入全局变量供所有页面直接使用
    }
  },

  // 确保全局变量初始化为空对象
  globalData: {}
})