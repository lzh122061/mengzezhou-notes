const db = wx.cloud.database();

Page({
  data: {
    // 权限状态
    isAdmin: false,

    // 列表一：图片管理 (动态生成)
    imageList: [],
    // 列表二：价格管理 (直接使用 roomList)
    roomList: [],

    // 编辑状态
    editingId: null, // 当前正在编辑的房间数据库_id
    tempPrices: {
      day: '',
      week: '',
      half: '',
      month: ''
    }
  },

  onLoad(options) {
    // 1. 执行原有的数据初始化
    this.initData();

    // 2. 新增：调用云函数获取 OpenID 进行管理员鉴权
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('[云函数] [login] user openid: ', res.result.openid)

        // 将 OpenID 存入本地缓存
        wx.setStorageSync('openid', res.result.openid);

        // 检查当前用户是否是管理员
        this.checkAdminStatus(res.result.openid);
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err)
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
    } else {
      console.log('普通用户');
      wx.setStorageSync('isAdmin', false);
      this.setData({
        isAdmin: false
      });
    }
  },

  // === 新增：跳转到后台管理页面 ===
  goToAdminPage() {
    wx.navigateTo({
      url: '/pages/admin/index',
      fail: (err) => {
        console.error('跳转失败，尝试 switchTab', err);
        // 如果 admin 在 tabBar 里，改用 switchTab
        wx.switchTab({ url: '/pages/admin/index' });
      }
    });
  },

  onPullDownRefresh() {
    this.initData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // ==============================
  // 1. 数据初始化
  // ==============================
  async initData() {
    wx.showLoading({
      title: '加载中...'
    });

    // 1. 加载房间数据
    let rooms = [];
    try {
      const res = await db.collection('rooms').orderBy('id', 'asc').get();
      rooms = res.data;
      this.setData({
        roomList: rooms
      });
    } catch (err) {
      console.error('加载房间数据失败:', err);
      wx.showToast({
        title: '房间加载失败',
        icon: 'none'
      });
    }

    // 2. 加载全局配置
    let config = {};
    try {
      const res = await db.collection('config').limit(1).get();
      if (res.data.length > 0) {
        config = res.data[0];
      }
    } catch (err) {
      console.log('读取config配置失败或暂无配置', err);
    }

    // 3. 组装图片管理列表
    this.buildImageList(rooms, config);

    wx.hideLoading();
  },

  // 组装图片列表
  buildImageList(rooms, config) {
    const list = [];

    // --- A. 头部：小程序首图 (支持多图预览) ---
    // 如果数据库存的是数组，取第一张作为 Admin 页面的缩略图
    let homeBannerUrl = config.home_banner || '';
    if (Array.isArray(homeBannerUrl) && homeBannerUrl.length > 0) {
      homeBannerUrl = homeBannerUrl[0];
    }

    list.push({
      id: 'global_home',
      name: '小程序首图 (可多选)',
      type: 'global',
      key: 'home_banner',
      currentUrl: homeBannerUrl
    });

    // --- B. 中部：房间展示图 ---
    rooms.forEach(room => {
      list.push({
        id: room._id,
        name: `${room.name} (可多选)`,
        type: 'room',
        key: 'cover_image',
        dbId: room._id,
        currentUrl: room.cover_image || ''
      });
    });

    // --- C. 尾部：公共区域 ---
    list.push({
      id: 'global_kitchen',
      name: '共享厨房 (可多选)', // 提示变更为可多选
      type: 'global',
      key: 'kitchen_img',
      currentUrl: config.kitchen_img || ''
    });

    list.push({
      id: 'global_public',
      name: '休闲公区 (可多选)', // 提示变更为可多选
      type: 'global',
      key: 'public_area_img',
      currentUrl: config.public_area_img || ''
    });

    this.setData({
      imageList: list
    });
  },


  // ==============================
  // 2. 图片上传逻辑
  // ==============================

  handleUploadImage(e) {
    const {
      index
    } = e.currentTarget.dataset;
    const item = this.data.imageList[index];

    // === 修改点 1：设置允许选择的数量 ===
    // 所有类型都允许上传 9 张
    let maxCount = 9;

    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePaths = res.tempFilePaths;
        this.uploadToCloud(filePaths, item, index);
      }
    });
  },

  // 上传到云存储
  uploadToCloud(filePaths, item, index) {
    wx.showLoading({
      title: `正在上传 ${filePaths.length} 张...`
    });

    const uploadTasks = filePaths.map((filePath, i) => {
      const fileIdKey = item.type === 'room' ? item.dbId : item.key;
      const cloudPath = `images/${item.type}_${fileIdKey}_${Date.now()}_${i}.jpg`;

      return wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      });
    });

    Promise.all(uploadTasks).then(results => {
      const fileIDs = results.map(res => res.fileID);
      console.log('上传成功，IDs:', fileIDs);

      this.updateImageDatabase(fileIDs, item, index);
    }).catch(err => {
      wx.hideLoading();
      console.error('上传云存储失败', err);
      wx.showToast({
        title: '部分上传失败',
        icon: 'none'
      });
    });
  },

  // 更新数据库
  updateImageDatabase(fileIDs, item, index) {
    let promise;
    const firstImage = fileIDs[0]; // 单张图逻辑用

    if (item.type === 'room') {
      // === 房间逻辑：更新 images 数组 + cover_image ===
      promise = db.collection('rooms').doc(item.dbId).update({
        data: {
          images: fileIDs,
          [item.key]: firstImage
        }
      });
    } else {
      // === 全局配置逻辑 (Config) ===
      promise = db.collection('config').get().then(res => {
        let dataToUpdate = {};

        // === 核心修改：确保公区和厨房也存入数组 ===
        if (item.key === 'home_banner') {
          dataToUpdate = {
            [item.key]: fileIDs
          };
        } else if (item.key === 'kitchen_img') {
          // 厨房：同时存 单图(兼容) 和 数组(轮播)
          dataToUpdate = {
            kitchen_img: firstImage,
            kitchen_images: fileIDs
          };
        } else if (item.key === 'public_area_img') {
          // 公区：同时存 单图(兼容) 和 数组(轮播)
          dataToUpdate = {
            public_area_img: firstImage,
            public_area_images: fileIDs
          };
        }

        if (res.data.length > 0) {
          return db.collection('config').doc(res.data[0]._id).update({
            data: dataToUpdate
          });
        } else {
          return db.collection('config').add({
            data: dataToUpdate
          });
        }
      });
    }

    promise.then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '更新成功'
      });

      // 更新本地视图 (Admin页面只显示第一张作为预览)
      const key = `imageList[${index}].currentUrl`;
      this.setData({
        [key]: firstImage
      });

    }).catch(err => {
      wx.hideLoading();
      console.error('更新数据库失败', err);
      wx.showToast({
        title: '存库失败',
        icon: 'none'
      });
    });
  },

  previewAdminImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({
        urls: [url]
      });
    }
  },

  // ==============================
  // 3. 价格管理逻辑 (原有功能)
  // ==============================

  editPrice(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      editingId: item._id,
      tempPrices: {
        day: item.price_day,
        week: item.price_week,
        half: item.price_half_month,
        month: item.price_month
      }
    });
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`tempPrices.${field}`]: value
    });
  },

  cancelEdit() {
    this.setData({
      editingId: null,
      tempPrices: {
        day: '',
        week: '',
        half: '',
        month: ''
      }
    });
  },

  savePrice(e) {
    const dbId = e.currentTarget.dataset.dbid;
    const p = this.data.tempPrices;

    wx.showLoading({
      title: '保存中...'
    });

    db.collection('rooms').doc(dbId).update({
      data: {
        price_day: Number(p.day),
        price_week: Number(p.week),
        price_half_month: Number(p.half),
        price_month: Number(p.month)
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功'
      });
      this.cancelEdit();
      this.initData();
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    });
  },
  
   // === 新增：返回首页函数 ===
   goBackToIndex() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
}
});