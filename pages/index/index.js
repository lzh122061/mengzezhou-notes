const db = wx.cloud.database();

Page({
  data: {
    // 权限状态
    isAdmin: false,
    isLogged: false, // 是否已点击登录

    // 存储用户信息
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },

    // 列表一：图片管理 (动态生成)
    imageList: [],
    roomList: [],

    // === 弹窗控制 ===
    showNoticeModal: false,   // "别点我"弹窗
    showContactModal: false,  // "联系人"弹窗
    showLoginEditModal: false, // 个人信息编辑弹窗

    // 临时存储用户填写的资料
    tempAvatarUrl: '',
    tempNickName: '',

    // === 随机文字列表 ===
    randomNotice: '', // 最终显示的文字
    noticeList: [
      "说了别点非要点",
      "你怎么又点进来了？",
      "这里真的什么都没有...",
      "好奇心害死猫，快出去~",
      "再点我就要顺着网线过去找你了",
      "别看了，快去看房间吧",
      "点一下就算了，别点第二次啊！",
      "说了别点非要点，你这一身反骨是几斤几两？",
      "让你别点，你还真听话……哦不对，你完全没听！",
      "再点？再点我就……就求你别点了",
      "哎呀，既然你诚心诚意地点了，那我就大发慈悲地告诉你：没东西",
      "手滑？我不信，你就是想引起我的注意",
      "警告：你的手机将在 3 秒后……并没有任何变化",
      "系统检测到您的好奇心已超标，正在通过摄像头对您进行颜值打分……",
      "正在格式化您的点击欲望……进度 99%……",
      "Error 404：你找的页面离家出走了",
      "恭喜你，解锁了传说中的‘空白弹窗’成就！",
      "嘘！这里是用来冬眠的，别吵",
      "每点击一次，世界上就会少喝一杯奶茶（骗你的）",
      "你再点，我就要给老板打小报告说你在摸鱼了！",
      "这里是VIP专属发呆位，请勿频繁操作",
      "既然点进来了，那就……祝你今天发大财吧！",
      "怎么，是上面的房间介绍不够好看，非要来这里点点点？",
      "你点一下，我弹一下，咱俩这算是……电子击掌？",
      "这里没有优惠券，只有一句：你好无聊啊（划掉）你好可爱啊！",
      "虽然你没听我的话，但看在你长得好看的份上，原谅你了",
      "别点了，代码都要被你点秃噜皮了"
    ]
  },

  onLoad(options) {
    this.initData();

    // 检查缓存中是否已有登录信息
    const cachedOpenid = wx.getStorageSync('openid');
    const cachedUserInfo = wx.getStorageSync('userInfo');
    
    if (cachedOpenid && cachedUserInfo) {
      this.setData({
        isLogged: true,
        userInfo: cachedUserInfo
      });
      // 每次进入页面都重新检查一次管理员权限，防止后台加了白名单但前端没刷新
      this.checkAdminStatus(cachedOpenid);
    }
  },

  // === 登录流程开始：弹出信息填写框 ===
  handleLogin() {
    if (this.data.isLogged) return;
    this.setData({
      showLoginEditModal: true
    });
  },

  // 用户点击圆圈选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      tempAvatarUrl: avatarUrl
    });
  },

  // 用户输入昵称
  onInputNickname(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },

  // 保存并登录核心逻辑
  saveUserInfoAndLogin() {
    const { tempAvatarUrl, tempNickName } = this.data;

    if (!tempAvatarUrl || !tempNickName) {
      wx.showToast({
        title: '请选头像并填昵称',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    // 1. 将头像上传到云存储 (因为临时路径会过期)
    const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempAvatarUrl,
      success: uploadRes => {
        const finalUserInfo = {
          avatarUrl: uploadRes.fileID,
          nickName: tempNickName
        };

        // 2. 调用云函数登录获取 OpenID
        wx.cloud.callFunction({
          name: 'login',
          success: res => {
            const openid = res.result.openid;
            
            // 存入缓存
            wx.setStorageSync('openid', openid);
            wx.setStorageSync('userInfo', finalUserInfo);

            this.setData({
              isLogged: true,
              userInfo: finalUserInfo,
              showLoginEditModal: false
            });

            // 检查管理员权限
            this.checkAdminStatus(openid);
            wx.hideLoading();
            wx.showToast({ title: '登录成功' });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '登录失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('上传头像失败', err);
        wx.hideLoading();
      }
    });
  },

  /**
   * 检查管理员权限 (修改为查数据库)
   */
  checkAdminStatus: function(openid) {
    if (!openid) return;

    // 查询 admins 集合
    db.collection('admins').where({
      openid: openid
    }).get().then(res => {
      if (res.data.length > 0) {
        console.log('管理员身份确认');
        wx.setStorageSync('isAdmin', true);
        this.setData({ isAdmin: true });
      } else {
        console.log('非管理员用户');
        wx.setStorageSync('isAdmin', false);
        this.setData({ isAdmin: false });
      }
    }).catch(err => {
      console.error('验证管理员失败', err);
      // 兜底策略：如果数据库读失败，保留原来的硬编码以防万一
      const superAdmins = ['oDwJG1yI3Poum-CHoryAeqtPETu0']; 
      if(superAdmins.includes(openid)) {
         this.setData({ isAdmin: true });
      } else {
         this.setData({ isAdmin: false });
      }
    });
  },

  // === 跳转到后台管理页面 ===
  goToAdminPage() {
    wx.navigateTo({
      url: '/pages/admin/index',
      fail: () => {
        wx.switchTab({ url: '/pages/admin/index' });
      }
    });
  },

  // === 1. “别点我” 弹窗逻辑 ===
  showNotice() {
    const list = this.data.noticeList;
    const randomIndex = Math.floor(Math.random() * list.length);
    this.setData({
      randomNotice: list[randomIndex],
      showNoticeModal: true
    });
  },
  closeNotice() {
    this.setData({ showNoticeModal: false });
  },

  // === 2. “联系人” 弹窗逻辑 ===
  handleContact() {
    this.setData({ showContactModal: true });
  },
  closeContactModal() {
    this.setData({ showContactModal: false });
  },
  confirmCall() {
    wx.makePhoneCall({
      phoneNumber: '13398720094',
      success: () => { this.setData({ showContactModal: false }); }
    });
  },

  // --- 底部导航跳转逻辑 ---
  navToHome() { wx.reLaunch({ url: '/pages/home/index' }); },
  navToNotes() { wx.reLaunch({ url: '/pages/notes/index' }); },
  navToMassage() { wx.reLaunch({ url: '/pages/massage/index' }); },
  navToMy() { /* 当前页 */ },

  // --- 数据初始化 ---
  async initData() {
    try {
      await db.collection('config').limit(1).get();
    } catch (err) {
      console.log('读取配置失败', err);
    }
  }
});