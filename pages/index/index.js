const db = wx.cloud.database();

Page({
  data: {
    // 权限状态
    isAdmin: false,
    isLogged: false, // 是否已点击登录

    // 列表一：图片管理 (动态生成) - 这里的配置加载是为了获取头像等公共信息
    imageList: [], 
    roomList: []
  },

  onLoad(options) {
    // 仅加载基础数据，不自动登录
    this.initData();
    
    // 检查缓存中是否已有管理员状态（避免刷新后按钮消失）
    const cachedAdmin = wx.getStorageSync('isAdmin');
    const cachedOpenid = wx.getStorageSync('openid');
    if (cachedOpenid) {
      this.setData({ isLogged: true });
      if (cachedAdmin) {
        this.setData({ isAdmin: true });
      }
    }
  },

  // === 手动点击登录 ===
  handleLogin() {
    wx.showLoading({ title: '正在登录...' });
    
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('[云函数] [login] user openid: ', res.result.openid)

        // 将 OpenID 存入本地缓存
        wx.setStorageSync('openid', res.result.openid);
        
        // 标记为已登录
        this.setData({ isLogged: true });

        // 检查当前用户是否是管理员
        this.checkAdminStatus(res.result.openid);
        
        wx.hideLoading();
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err)
        wx.hideLoading();
        wx.showToast({
          title: '登录失败，请检查网络',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 检查管理员权限
   */
  checkAdminStatus: function (openid) {
    const admins = [
      'oDwJG1yI3Poum-CHoryAeqtPETu0' // 您的 OpenID
    ];

    // 判断当前用户是否在管理员名单里
    if (admins.includes(openid)) {
      console.log('管理员身份确认');
      wx.setStorageSync('isAdmin', true);
      this.setData({
        isAdmin: true
      });
      wx.showToast({ title: '管理员已验证', icon: 'success' });
    } else {
      console.log('普通用户');
      wx.setStorageSync('isAdmin', false);
      this.setData({
        isAdmin: false
      });
      wx.showToast({ title: '访客模式', icon: 'none' });
    }
  },

  // === 核心修复：跳转到后台管理页面 ===
  goToAdminPage() {
    console.log('尝试跳转到管理员后台...');
    wx.navigateTo({
      url: '/pages/admin/index',
      fail: (err) => {
        console.error('普通跳转失败，尝试 SwitchTab...', err);
        // 如果失败，尝试 switchTab (防止 admin 页面被误配为 tabBar 页面)
        wx.switchTab({ 
          url: '/pages/admin/index',
          fail: (err2) => {
             console.error('跳转完全失败，请检查 app.json 是否注册了 /pages/admin/index', err2);
             wx.showModal({
               title: '跳转失败',
               content: '找不到管理员页面，请检查代码配置',
               showCancel: false
             });
          }
        });
      }
    });
  },

  // === 菜单功能 ===
  showNotice() {
    wx.showModal({
      title: '入住须知',
      content: '1. 入住时间：14:00以后\n2. 退房时间：12:00以前\n3. 请保持房间整洁',
      showCancel: false
    });
  },

  handleContact() {
    wx.makePhoneCall({
      phoneNumber: '13800000000' // 请修改为您的号码
    });
  },

    // --- 底部导航跳转逻辑 ---
    navToHome() {
      wx.reLaunch({
        url: '/pages/home/index'
      });
    },
  
    navToNotes() {
      wx.reLaunch({
        url: '/pages/notes/index'
      });
    },
  
    navToMassage() {
      wx.reLaunch({
        url: '/pages/massage/index'
      });
    },
  
  navToMy() {
    // 当前页面，不做操作
  },

  // ==============================
  // 数据初始化 (保留用于获取公共配置信息)
  // ==============================
  async initData() {
    // 简单的加载逻辑，不再包含上传和价格编辑
    let config = {};
    try {
      const res = await db.collection('config').limit(1).get();
      if (res.data.length > 0) {
        config = res.data[0];
      }
    } catch (err) {
      console.log('读取配置失败', err);
    }
  }
});