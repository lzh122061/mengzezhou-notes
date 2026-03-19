const db = wx.cloud.database();

Page({
  data: {
    // 定义11个图片位
    list: [
      { id: 1, name: '小程序首图', type: 'global', key: 'home_banner', currentUrl: '' },
      { id: 2, name: '101 照片', type: 'room', key: 'cover_image', dbId: '101', currentUrl: '' },
      { id: 3, name: '102 照片', type: 'room', key: 'cover_image', dbId: '102', currentUrl: '' },
      { id: 4, name: '103 照片', type: 'room', key: 'cover_image', dbId: '103', currentUrl: '' },
      { id: 5, name: '104 照片', type: 'room', key: 'cover_image', dbId: '104', currentUrl: '' },
      { id: 6, name: '105 照片', type: 'room', key: 'cover_image', dbId: '105', currentUrl: '' },
      { id: 7, name: '106 照片', type: 'room', key: 'cover_image', dbId: '106', currentUrl: '' },
      { id: 8, name: '107 照片', type: 'room', key: 'cover_image', dbId: '107', currentUrl: '' },
      { id: 9, name: '108 照片', type: 'room', key: 'cover_image', dbId: '108', currentUrl: '' },
      { id: 10, name: '共享厨房', type: 'global', key: 'kitchen_img', currentUrl: '' },
      { id: 11, name: '休闲公区', type: 'global', key: 'public_area_img', currentUrl: '' }
    ],
    // ★ 新增：用于双向绑定的今日心情文本
    todayMood: ''
  },

  onLoad() {
    this.loadData();
  },

  // 加载当前图片数据和心情数据
  async loadData() {
    wx.showLoading({ title: '加载中...' });
    const list = this.data.list;
    
    // 1. 获取全局配置图片 (首图、厨房、公区) & 今日心情
    try {
      const configRes = await db.collection('config').limit(1).get(); 
      if (configRes.data.length > 0) {
        const configData = configRes.data[0];
        
        // ★ 新增：从数据库读取并赋值今日心情
        this.setData({
          todayMood: configData.today_mood || ''
        });
        
        list.forEach(item => {
          if (item.type === 'global') {
            if (configData[item.key]) {
              item.currentUrl = configData[item.key];
            }
          }
        });
      }

      // 2. 获取房间图片
      const roomItems = list.filter(item => item.type === 'room');
      
      const roomQueries = roomItems.map(item => {
        return db.collection('rooms').where({
          room_number: item.dbId // 假设数据库房间号字段为 room_number
        }).get().then(res => {
          if (res.data.length > 0) {
            return { id: item.id, url: res.data[0][item.key] };
          }
          return { id: item.id, url: '' };
        });
      });

      const roomResults = await Promise.all(roomQueries);
      
      roomResults.forEach(res => {
        const target = list.find(l => l.id === res.id);
        if (target) target.currentUrl = res.url;
      });

      this.setData({ list });

    } catch (err) {
      console.error('加载图片失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // === ★ 新增：监听输入框内容变化 ===
  onMoodInput(e) {
    this.setData({
      todayMood: e.detail.value
    });
  },

  // === ★ 新增：单独保存心情到数据库 ===
  async saveMood() {
    if (!this.data.todayMood.trim()) {
      // 也可以允许为空（用于清空折叠不显示），视你需求而定
      // 如果允许为空，这行判断可删掉
    }

    wx.showLoading({ title: '保存心情中...' });
    try {
      const res = await db.collection('config').limit(1).get();
      if (res.data.length > 0) {
        // 更新已有记录
        await db.collection('config').doc(res.data[0]._id).update({
          data: { today_mood: this.data.todayMood }
        });
      } else {
        // 防止数据库为空时报错，做个兜底创建
        await db.collection('config').add({
          data: { today_mood: this.data.todayMood }
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '心情更新成功', icon: 'success' });
    } catch (err) {
      console.error('保存心情失败', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 处理上传点击 (维持原样)
  handleUpload(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.list[index];

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0];
        this.uploadToCloud(filePath, item, index);
      }
    });
  },

  // 上传到云存储 (维持原样)
  uploadToCloud(filePath, item, index) {
    wx.showLoading({ title: '上传中...' });
    
    const cloudPath = `images/${item.type}_${item.dbId || 'global'}_${Date.now()}.jpg`;

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        console.log('上传成功', res.fileID);
        this.updateDatabase(res.fileID, item, index);
      },
      fail: err => {
        console.error('上传失败', err);
        wx.hideLoading();
        wx.showToast({ title: '上传出错', icon: 'none' });
      }
    });
  },

  // 更新图片数据库 (维持原样)
  updateDatabase(fileId, item, index) {
    let promise;

    if (item.type === 'room') {
      promise = db.collection('rooms').where({
        room_number: item.dbId
      }).update({
        data: {
          [item.key]: fileId
        }
      });
    } else {
      promise = db.collection('config').limit(1).get().then(res => {
        if (res.data.length > 0) {
           return db.collection('config').doc(res.data[0]._id).update({
             data: { [item.key]: fileId }
           });
        }
      });
    }

    promise.then(() => {
      wx.hideLoading();
      wx.showToast({ title: '更新成功' });
      
      const key = `list[${index}].currentUrl`;
      this.setData({
        [key]: fileId
      });
    }).catch(err => {
      console.error('数据库更新失败', err);
      wx.hideLoading();
      wx.showToast({ title: '存库失败', icon: 'none' });
    });
  },
  
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if(url) {
      wx.previewImage({
        urls: [url],
      });
    }
  }
});