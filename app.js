App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        traceUser: true,
      })
    }

    // === [核心修改] 使用 wx.loadFontFace 动态加载字体 ===
    wx.loadFontFace({
      global: true, // 是否全局生效
      family: 'CustomFont', // 字体名称
      source: 'url("https://636c-cloud1-7gvskpoo2a3897dc-1392473051.tcb.qcloud.la/fonts/ziyueyinyingsong-s-Regular.woff2?sign=b16aaafafa85112c63cea984483c4946&t=1766161826")',
      success(res) {
        console.log('字体加载成功', res.status)
      },
      fail: function (res) {
        console.error('字体加载失败', res)
      }
    })

    this.globalData = {}
  }
})